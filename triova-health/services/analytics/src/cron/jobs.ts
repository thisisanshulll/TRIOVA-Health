import cron from 'node-cron';
import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../../../../shared/queues/redis-client';
import { QUEUE_NAMES, analyticsQueue } from '../../../../shared/queues/queue-definitions';
import { pool } from '../../../../shared/db/pool';
import { wearablesService } from '../services/wearables.service';
import { TrendsAnalysisAgent } from '../agents/TrendsAnalysisAgent';
import { logger } from '../../../../shared/utils/logger';

export function startCronJobs() {
  const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  };

  const agent = new TrendsAnalysisAgent();

  // Worker for heavy trend generation
  const worker = new Worker(QUEUE_NAMES.ANALYTICS_PROCESSING, async (job: Job) => {
    logger.info(`Processing trend analysis for patient ${job.data.patientId}`);
    try {
      await agent.analyzePatientTrends(job.data.patientId);
    } catch (err: any) {
      logger.error(`Trend analysis job failed`, err);
      throw err;
    }
  }, { connection });

  // 1. Recalculate Baselines (Nightly 2 AM)
  cron.schedule('0 2 * * *', async () => {
    logger.info('Starting nightly baseline recalculation');
    try {
      const activePatients = await pool.query(`SELECT DISTINCT patient_id FROM wearable_data WHERE recorded_at > NOW() - INTERVAL '7 days'`);
      for (const row of activePatients.rows) {
        await agent.recalculateBaselines(row.patient_id).catch(err => logger.error(`Baseline calc failed for ${row.patient_id}`, err));
      }
    } catch (err) { logger.error('Nightly cron failed', err); }
  });

  // 2. Mock Data Generator (Every 15 mins for active pilot patients)
  // For demo/pilot purposes, generate realistic wearable fluctuations
  cron.schedule('*/15 * * * *', async () => {
    if (process.env.NODE_ENV !== 'production' && process.env.SIMULATE_WEARABLES === 'true') {
      logger.info('Running mock wearable data generator');
      try {
        const patients = await pool.query('SELECT id FROM patients LIMIT 20');
        for (const p of patients.rows) {
          // Add some jitter to previous reading
          const last = await wearablesService.getLatestReading(p.id);
          const hr = last ? last.heart_rate + (Math.random() * 10 - 5) : 75;
          const sys = last ? last.blood_pressure_systolic + (Math.random() * 6 - 3) : 120;
          
          await wearablesService.recordReading({
            patient_id: p.id,
            heart_rate: Math.round(Math.max(40, Math.min(180, hr))),
            spo2: Math.round(Math.max(85, Math.min(100, last?.spo2 || 98 + Math.random() * 2 - 1))),
            blood_pressure_systolic: Math.round(sys),
            blood_pressure_diastolic: Math.round(sys * 0.66), // rough estimate
            temperature_celsius: 36.5 + Math.random() * 1,
            steps: (last?.steps || 0) + Math.round(Math.random() * 500),
            data_source: 'mock'
          });
        }
      } catch (err) { logger.error('Mock data generator failed', err); }
    }
  });

  logger.info('Analytics cron jobs scheduled');
}
