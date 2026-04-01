import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { appointmentRoutes } from './routes/appointment.routes';
import { errorMiddleware } from '../../shared/middleware/error.middleware';
import { logger } from '../../shared/utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.APPOINTMENT_PORT || 3002;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'appointment-service', timestamp: new Date().toISOString() });
});

app.use('/api/appointments', appointmentRoutes);
app.use(errorMiddleware);

app.listen(PORT, () => logger.info(`Appointment service running on port ${PORT}`));

export default app;
