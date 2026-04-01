import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { authRoutes } from './routes/auth.routes';
import { errorMiddleware } from '../../shared/middleware/error.middleware';
import { logger } from '../../shared/utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.AUTH_PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use(errorMiddleware);

app.listen(PORT, () => {
  logger.info(`Auth service running on port ${PORT}`);
});

export default app;
