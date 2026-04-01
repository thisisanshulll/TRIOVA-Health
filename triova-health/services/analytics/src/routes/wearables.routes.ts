import { Router } from 'express';
import { wearablesController } from '../controllers/wearables.controller';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { roleMiddleware } from '../../../shared/middleware/role.middleware';

const router = Router();
router.use(authMiddleware);

router.post('/sync', roleMiddleware('patient'), wearablesController.syncData);
router.get('/latest/:patient_id', wearablesController.getLatest);
router.get('/history/:patient_id', wearablesController.getHistory);
router.post('/simulate-anomaly', roleMiddleware('patient', 'admin'), wearablesController.simulateAnomaly);

export { router as wearableRoutes };
