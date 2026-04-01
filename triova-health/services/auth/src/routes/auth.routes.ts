import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validateBody } from '../../../shared/middleware/validate.middleware';
import { loginRateLimiter } from '../../../shared/middleware/rate-limit.middleware';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { z } from 'zod';

const router = Router();

const registerPatientSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[A-Z])(?=.*[0-9])/, 'Password must contain uppercase and number'),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  date_of_birth: z.string(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  phone: z.string().min(10),
  preferred_language: z.string().optional(),
});

const registerDoctorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[A-Z])(?=.*[0-9])/, 'Password must contain uppercase and number'),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().min(10),
  specialization: z.string().min(1),
  license_number: z.string().min(1),
  qualification: z.string().optional(),
  experience_years: z.number().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/register/patient', validateBody(registerPatientSchema), authController.registerPatient);
router.post('/register/doctor', validateBody(registerDoctorSchema), authController.registerDoctor);
router.post('/login', loginRateLimiter, validateBody(loginSchema), authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.get('/me', authMiddleware, authController.getMe);

export { router as authRoutes };
