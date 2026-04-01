import { Router } from 'express';
import multer from 'multer';
import { recordsController } from '../controllers/records.controller';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { uploadRateLimiter, ragRateLimiter } from '../../../shared/middleware/rate-limit.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authMiddleware);

router.post('/upload', uploadRateLimiter, upload.single('file'), recordsController.uploadDocument);
router.get('/patient/:patient_id', recordsController.listDocuments);
router.get('/document/:document_id', recordsController.getDocument);
router.delete('/document/:document_id', recordsController.deleteDocument);
router.post('/chat', ragRateLimiter, recordsController.ragChat);
router.get('/chat-history/:patient_id', recordsController.getChatHistory);
router.get('/export/:patient_id', recordsController.exportPdf);
router.post('/reprocess/:document_id', recordsController.reprocessDocument);

export { router as recordsRoutes };
