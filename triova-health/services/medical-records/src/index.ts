import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import multer from 'multer';
import { recordsRoutes } from './routes/records.routes';
import { errorMiddleware } from '../../shared/middleware/error.middleware';
import { logger } from '../../shared/utils/logger';
import { startDocumentWorker } from './workers/document.worker';

dotenv.config();
const app = express();
const PORT = process.env.RECORDS_PORT || 3004;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'medical-records-service' }));
app.use('/api/medical-records', recordsRoutes);
app.use(errorMiddleware);

startDocumentWorker();

app.listen(PORT, () => logger.info(`Medical Records service running on port ${PORT}`));
export default app;
