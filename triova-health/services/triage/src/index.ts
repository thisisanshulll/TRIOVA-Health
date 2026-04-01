import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { triageRoutes } from './routes/triage.routes';
import { errorMiddleware } from '../../shared/middleware/error.middleware';
import { logger } from '../../shared/utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.TRIAGE_PORT || 3003;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'triage-service', timestamp: new Date().toISOString() });
});

app.use('/api/triage', triageRoutes);
app.use(errorMiddleware);

app.listen(PORT, () => logger.info(`Triage service running on port ${PORT}`));
export default app;
