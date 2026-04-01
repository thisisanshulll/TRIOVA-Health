import { Queue, Worker, QueueOptions } from 'bullmq';
import { getRedisClient } from './redis-client';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const QUEUE_NAMES = {
  DOCUMENT_PROCESSING: 'document-processing',
  EMAIL_NOTIFICATIONS: 'email-notifications',
  SMS_NOTIFICATIONS: 'sms-notifications',
  ANALYTICS_PROCESSING: 'analytics-processing',
  MEDICATION_EXTRACTION: 'medication-extraction',
} as const;

export function createQueue(name: string, options?: Partial<QueueOptions>) {
  return new Queue(name, { connection, ...options });
}

export const documentProcessingQueue = createQueue(QUEUE_NAMES.DOCUMENT_PROCESSING, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 },
  },
});

export const emailQueue = createQueue(QUEUE_NAMES.EMAIL_NOTIFICATIONS, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 30000 },
  },
});

export const smsQueue = createQueue(QUEUE_NAMES.SMS_NOTIFICATIONS, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 30000 },
  },
});

export const analyticsQueue = createQueue(QUEUE_NAMES.ANALYTICS_PROCESSING, {
  defaultJobOptions: { attempts: 2 },
});

export const medicationExtractionQueue = createQueue(QUEUE_NAMES.MEDICATION_EXTRACTION, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 },
  },
});
