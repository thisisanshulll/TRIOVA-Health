import cron from 'node-cron';
import { pool } from '../../../../shared/db/pool';
import { notificationsService } from '../services/notifications.service';
import { emailQueue, smsQueue } from '../../../../shared/queues/queue-definitions';
import { logger } from '../../../../shared/utils/logger';

export function startReminderCron() {
  
  // 1. Appointment Reminders (Runs every hour)
  cron.schedule('0 * * * *', async () => {
    logger.info('Running appointment reminder cron');
    try {
      // Find appointments in EXACTLY 24 hours
      const tomorrowStarts = new Date();
      tomorrowStarts.setHours(tomorrowStarts.getHours() + 24, 0, 0, 0);
      const tomorrowEnds = new Date(tomorrowStarts.getTime() + 60 * 60 * 1000 - 1);
      
      const appts = await pool.query(
        `SELECT a.*, p.first_name as p_fname, u.email as p_email, p.phone as p_phone, d.first_name as d_fname
         FROM appointments a 
         JOIN patients p ON a.patient_id = p.id
         JOIN users u ON p.user_id = u.id
         JOIN doctors d ON a.doctor_id = d.id
         WHERE a.status = 'scheduled' 
         AND a.appointment_date = $1 AND a.appointment_time >= $2::time AND a.appointment_time < $3::time`,
         [tomorrowStarts.toISOString().split('T')[0], tomorrowStarts.toISOString().split('T')[1].slice(0,8), tomorrowEnds.toISOString().split('T')[1].slice(0,8)]
      );

      for (const row of appts.rows) {
        // App Notification
        await notificationsService.createNotification(
          row.patient_id, // technically needs user_id, mapping later
          'appointment_reminder',
          'Upcoming Appointment Tomorrow',
          `Reminder: You have an appointment with Dr. ${row.d_fname} tomorrow at ${row.appointment_time}.`,
          'high',
          { entityId: row.id, entityType: 'appointment' }
        );

        // Queue Email
        await emailQueue.add('sendEmail', {
          to: row.p_email,
          subject: 'Appointment Reminder - TRIOVA Health',
          text: `Hi ${row.p_fname}, this is a reminder for your appointment tomorrow with Dr. ${row.d_fname} at ${row.appointment_time}.`
        });

        // Queue SMS if phone exists
        if (row.p_phone) {
          await smsQueue.add('sendSMS', {
            to: row.p_phone,
            message: `TRIOVA: Reminder for appointment tomorrow at ${row.appointment_time} with Dr. ${row.d_fname}.`
          });
        }
      }
    } catch (err) { logger.error('Appointment cron failed', err); }
  });

  // 2. Medication Reminders (Runs every 15 mins)
  cron.schedule('*/15 * * * *', async () => {
    // In a real system, you'd parse timing_instructions (e.g. '08:00', '20:00') 
    // and match with the current time. This is a simplified cron base.
    logger.info('Medication reminder cron heartbeat');
  });

  logger.info('Notification reminder cron jobs scheduled');
}
