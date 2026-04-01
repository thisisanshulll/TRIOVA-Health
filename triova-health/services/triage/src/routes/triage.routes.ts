import { Router } from 'express';
import { triageController } from '../controllers/triage.controller';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { roleMiddleware } from '../../../shared/middleware/role.middleware';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authMiddleware);

router.post('/start', roleMiddleware('patient'), triageController.startSession);
router.post('/answer', roleMiddleware('patient'), triageController.submitAnswer);
router.post('/voice-answer', roleMiddleware('patient'), triageController.voiceAnswer);
router.post('/upload-image', roleMiddleware('patient'), upload.single('image'), triageController.uploadImage);
router.get('/summary/:session_id', triageController.getSummary);
router.get('/history/:patient_id', triageController.getHistory);
router.get('/questions', triageController.getQuestions);
router.post('/abandon/:session_id', roleMiddleware('patient'), triageController.abandonSession);
router.get('/active/:patient_id', roleMiddleware('patient'), triageController.getActiveSession);

export { router as triageRoutes };
