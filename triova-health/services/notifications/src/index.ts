import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { notificationRoutes } from './routes/notifications.routes';
import { errorMiddleware } from '../../shared/middleware/error.middleware';
import { logger } from '../../shared/utils/logger';
import { startNotificationWorkers } from './workers/notification.workers';
import { startReminderCron } from './cron/reminders';

dotenv.config();

const app = express();
const PORT = process.env.NOTIFICATION_PORT || 3005;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));

app.use('/api/notifications', notificationRoutes);
app.use(errorMiddleware);

// Initialize Workers & Cron Jobs
startNotificationWorkers();
startReminderCron();

app.listen(PORT, () => {
  logger.info(`Notification service running on port ${PORT}`);
});

export default app;
