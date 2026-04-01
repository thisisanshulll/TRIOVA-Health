import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { wearableRoutes } from './routes/wearables.routes';
import { analyticsRoutes } from './routes/analytics.routes';
import { errorMiddleware } from '../../shared/middleware/error.middleware';
import { logger } from '../../shared/utils/logger';
import { startCronJobs } from './cron/jobs';

dotenv.config();

const app = express();
const PORT = process.env.ANALYTICS_PORT || 3006;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'analytics-service' }));

app.use('/api/wearables', wearableRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use(errorMiddleware);

startCronJobs();

app.listen(PORT, () => {
  logger.info(`Analytics service running on port ${PORT}`);
});

export default app;
