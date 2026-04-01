import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { QUEUE_NAMES } from '../../../../shared/queues/queue-definitions';
import { logger } from '../../../../shared/utils/logger';

export function startNotificationWorkers() {
  const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  };

  // NodeMailer configuration
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.SMTP_PORT || '2525'),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Twilio SMS
  const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

  // Email Worker
  const emailWorker = new Worker(QUEUE_NAMES.EMAIL_NOTIFICATIONS, async (job: Job) => {
    const { to, subject, html, text } = job.data;
    logger.info(`Sending email to ${to} for subject: ${subject}`);
    
    try {
      const info = await transporter.sendMail({
        from: '"TRIOVA Health" <noreply@triovahealth.com>',
        to,
        subject,
        text,
        html,
      });
      logger.info(`Email sent: ${info.messageId}`);
    } catch (err) {
      logger.error('Email sending failed', err);
      throw err;
    }
  }, { connection, concurrency: 5 });

  // SMS Worker
  const smsWorker = new Worker(QUEUE_NAMES.SMS_NOTIFICATIONS, async (job: Job) => {
    const { to, message } = job.data;
    logger.info(`Sending SMS to ${to}`);
    
    if (!twilioClient) {
      logger.warn('Twilio not configured, skipping SMS');
      return;
    }

    try {
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to,
      });
      logger.info('SMS sent successfully');
    } catch (err) {
      logger.error('SMS sending failed', err);
      throw err;
    }
  }, { connection, concurrency: 2 });

  logger.info('Notification workers (Email/SMS) started');
}
