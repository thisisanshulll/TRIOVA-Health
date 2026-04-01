import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { roleMiddleware } from '../../../shared/middleware/role.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/patient-dashboard/:patient_id', analyticsController.getPatientDashboard);
router.get('/doctor-dashboard/:doctor_id', roleMiddleware('doctor'), analyticsController.getDoctorDashboard);
router.post('/trends/analyze/:patient_id', roleMiddleware('doctor', 'admin'), analyticsController.triggerTrendAnalysis);
router.post('/alerts/:alert_id/acknowledge', analyticsController.acknowledgeAlert);
router.post('/alerts/:alert_id/resolve', analyticsController.resolveAlert);

export { router as analyticsRoutes };
