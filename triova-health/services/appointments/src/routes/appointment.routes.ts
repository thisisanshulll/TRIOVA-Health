import { Router } from 'express';
import { appointmentController } from '../controllers/appointment.controller';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { roleMiddleware } from '../../../shared/middleware/role.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/voice-booking', roleMiddleware('patient'), appointmentController.voiceBooking);
router.post('/book', roleMiddleware('patient'), appointmentController.bookAppointment);
router.get('/available-slots', appointmentController.getAvailableSlots);
router.get('/slots/next-available', appointmentController.getNextAvailable);
router.get('/patient/:patient_id', appointmentController.getPatientAppointments);
router.get('/doctor/:doctor_id', roleMiddleware('doctor', 'admin'), appointmentController.getDoctorAppointments);
router.patch('/:id/status', roleMiddleware('doctor', 'admin'), appointmentController.updateStatus);
router.patch('/:id/cancel', appointmentController.cancelAppointment);
router.get('/:id/queue-status', appointmentController.getQueueStatus);
router.post('/availability', roleMiddleware('doctor'), appointmentController.setAvailability);
router.patch('/availability/:id', roleMiddleware('doctor'), appointmentController.updateAvailability);
router.post('/unavailability', roleMiddleware('doctor'), appointmentController.setUnavailability);

export { router as appointmentRoutes };
