import { Router } from 'express';
import { doctorsController } from '../controllers/doctors.controller';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { roleMiddleware } from '../../../shared/middleware/role.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/', doctorsController.listDoctors);
router.get('/:id', doctorsController.getDoctor);
router.patch('/:id', roleMiddleware('doctor'), doctorsController.updateDoctor);
router.get('/:id/patients', roleMiddleware('doctor'), doctorsController.getDoctorPatients);

// Consultations
router.post('/consultations', roleMiddleware('doctor'), doctorsController.createConsultation);
router.get('/consultations/:id', doctorsController.getConsultation);
router.get('/consultations/patient/:patient_id', doctorsController.getPatientConsultations);
router.post('/consultations/:id/medications', roleMiddleware('doctor'), doctorsController.addPrescribedMedications);

export { router as doctorRoutes };
