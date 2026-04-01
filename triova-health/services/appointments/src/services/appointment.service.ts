import { pool } from '../../../shared/db/pool';
import { logger } from '../../../shared/utils/logger';

export const appointmentService = {
  async bookAppointment(dto: any) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock to prevent double booking
      const conflict = await client.query(
        `SELECT id FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 AND status NOT IN ('cancelled','no_show') FOR UPDATE`,
        [dto.doctor_id, dto.date, dto.time]
      );
      if (conflict.rows.length) throw new Error('Slot already booked');

      // Get queue position for today
      const queueResult = await client.query(
        `SELECT COUNT(*) as count FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND status NOT IN ('cancelled','no_show')`,
        [dto.doctor_id, dto.date]
      );
      const queuePosition = parseInt(queueResult.rows[0].count) + 1;
      const estimatedWait = (queuePosition - 1) * 30;

      // Emergency: find and push routine appointment if needed
      if (dto.urgency === 'emergency') {
        await this.handleEmergencyBooking(client, dto.doctor_id, dto.date, dto.time);
      }

      const result = await client.query(
        `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, urgency, chief_complaint, booking_method, booking_notes, queue_position, estimated_wait_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [dto.patient_id, dto.doctor_id, dto.date, dto.time, dto.urgency || 'routine', dto.chief_complaint, dto.booking_method || 'manual', dto.booking_notes, queuePosition, estimatedWait]
      );

      await client.query('COMMIT');
      return { appointment: result.rows[0], queue_position: queuePosition, estimated_wait: estimatedWait };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async handleEmergencyBooking(client: any, doctorId: string, date: string, time: string) {
    // Find a routine appointment to push back 15 minutes
    const routine = await client.query(
      `SELECT id, appointment_time FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND urgency = 'routine' AND status = 'scheduled' ORDER BY appointment_time LIMIT 1`,
      [doctorId, date]
    );
    if (routine.rows.length) {
      const appt = routine.rows[0];
      const [h, m] = appt.appointment_time.split(':').map(Number);
      const newTime = new Date(0, 0, 0, h, m + 15, 0);
      const newTimeStr = `${newTime.getHours().toString().padStart(2, '0')}:${newTime.getMinutes().toString().padStart(2, '0')}:00`;
      await client.query(`UPDATE appointments SET appointment_time = $1 WHERE id = $2`, [newTimeStr, appt.id]);
      logger.info(`Pushed routine appointment ${appt.id} to ${newTimeStr} for emergency`);
    }
  },

  async getAlternativeSlots(doctorId: string, date: string, _preferredTime: string) {
    const result = await pool.query(
      `SELECT da.start_time, da.end_time, da.slot_duration_minutes
       FROM doctor_availability da WHERE da.doctor_id = $1 AND da.day_of_week = EXTRACT(DOW FROM $2::date) AND da.is_active = TRUE`,
      [doctorId, date]
    );
    const alternatives: string[] = [];
    for (const avail of result.rows) {
      let slotTime = avail.start_time;
      while (slotTime < avail.end_time && alternatives.length < 3) {
        const conflict = await pool.query(
          `SELECT id FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 AND status NOT IN ('cancelled','no_show')`,
          [doctorId, date, slotTime]
        );
        if (!conflict.rows.length) alternatives.push(slotTime);
        const [h, m] = slotTime.split(':').map(Number);
        const next = new Date(0, 0, 0, h, m + avail.slot_duration_minutes, 0);
        slotTime = `${next.getHours().toString().padStart(2, '0')}:${next.getMinutes().toString().padStart(2, '0')}:00`;
      }
    }
    return alternatives.slice(0, 3);
  },

  async getPatientAppointments(patientId: string, filters: any) {
    const now = new Date().toISOString().split('T')[0];
    const upcoming = await pool.query(
      `SELECT a.*, d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.specialization
       FROM appointments a JOIN doctors d ON a.doctor_id = d.id
       WHERE a.patient_id = $1 AND a.appointment_date >= $2 AND a.status NOT IN ('cancelled','completed','no_show')
       ORDER BY a.appointment_date, a.appointment_time LIMIT 10`,
      [patientId, now]
    );
    const past = await pool.query(
      `SELECT a.*, d.first_name as doctor_first_name, d.last_name as doctor_last_name
       FROM appointments a JOIN doctors d ON a.doctor_id = d.id
       WHERE a.patient_id = $1 AND (a.appointment_date < $2 OR a.status IN ('completed','cancelled','no_show'))
       ORDER BY a.appointment_date DESC LIMIT 20`,
      [patientId, now]
    );
    return { upcoming: upcoming.rows, past: past.rows };
  },

  async getDoctorAppointments(doctorId: string, filters: any) {
    const date = filters.date || new Date().toISOString().split('T')[0];
    const result = await pool.query(
      `SELECT a.*, p.first_name as patient_first_name, p.last_name as patient_last_name
       FROM appointments a JOIN patients p ON a.patient_id = p.id
       WHERE a.doctor_id = $1 AND a.appointment_date = $2 AND a.status NOT IN ('cancelled')
       ORDER BY a.urgency DESC, a.appointment_time`,
      [doctorId, date]
    );
    const counts = {
      emergency: result.rows.filter((r: any) => r.urgency === 'emergency').length,
      urgent: result.rows.filter((r: any) => r.urgency === 'urgent').length,
      routine: result.rows.filter((r: any) => r.urgency === 'routine').length,
      total: result.rows.length,
    };
    return { appointments: result.rows, counts };
  },

  async updateStatus(id: string, status: string, cancellationReason?: string) {
    const result = await pool.query(
      `UPDATE appointments SET status = $1, cancellation_reason = $2 WHERE id = $3 RETURNING *`,
      [status, cancellationReason || null, id]
    );
    return result.rows[0];
  },

  async cancelAppointment(id: string, reason: string, cancelledBy: string) {
    const result = await pool.query(
      `UPDATE appointments SET status = 'cancelled', cancellation_reason = $1, cancelled_by = $2, cancelled_at = NOW() WHERE id = $3 RETURNING *`,
      [reason, cancelledBy, id]
    );
    return result.rows[0];
  },

  async getById(id: string) {
    const result = await pool.query(`SELECT * FROM appointments WHERE id = $1`, [id]);
    return result.rows[0];
  },

  async getQueueStatus(appointmentId: string) {
    const appt = await pool.query(`SELECT * FROM appointments WHERE id = $1`, [appointmentId]);
    if (!appt.rows.length) throw new Error('Appointment not found');
    const a = appt.rows[0];
    const ahead = await pool.query(
      `SELECT COUNT(*) as count FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND queue_position < $3 AND status = 'scheduled'`,
      [a.doctor_id, a.appointment_date, a.queue_position]
    );
    return {
      position: a.queue_position,
      ahead_count: parseInt(ahead.rows[0].count),
      estimated_wait_minutes: parseInt(ahead.rows[0].count) * 30,
      status: a.status,
    };
  },
};
