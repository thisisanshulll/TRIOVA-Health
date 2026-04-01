import { Router } from 'express';
import { patientsController } from '../controllers/patients.controller';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { roleMiddleware } from '../../../shared/middleware/role.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/:id', patientsController.getPatient);
router.patch('/:id', roleMiddleware('patient'), patientsController.updatePatient);
router.post('/:id/allergies', roleMiddleware('patient', 'doctor'), patientsController.addAllergy);
router.delete('/:id/allergies/:allergy_id', roleMiddleware('patient'), patientsController.removeAllergy);
router.post('/:id/conditions', roleMiddleware('patient', 'doctor'), patientsController.addCondition);
router.delete('/:id/conditions/:condition_id', roleMiddleware('doctor', 'admin'), patientsController.removeCondition);
router.post('/:id/medications', roleMiddleware('patient'), patientsController.addMedication);
router.patch('/:id/medications/:medication_id', roleMiddleware('patient'), patientsController.updateMedication);
router.get('/:id/full-history', patientsController.getFullHistory);

export { router as patientRoutes };
