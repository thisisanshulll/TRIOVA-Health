import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { sendSuccess, sendError } from '../../../shared/utils/response';
import { logger } from '../../../shared/utils/logger';

export const authController = {
  async registerPatient(req: Request, res: Response) {
    try {
      const result = await authService.registerPatient(req.body);
      return sendSuccess(res, result, 'Patient registered successfully', 201);
    } catch (err: any) {
      logger.error('Register patient error', err);
      if (err.message?.includes('duplicate') || err.code === '23505') {
        return sendError(res, 'Email or phone already registered', 409);
      }
      return sendError(res, err.message || 'Registration failed');
    }
  },

  async registerDoctor(req: Request, res: Response) {
    try {
      const result = await authService.registerDoctor(req.body);
      return sendSuccess(res, result, 'Doctor registered successfully', 201);
    } catch (err: any) {
      logger.error('Register doctor error', err);
      if (err.code === '23505') {
        return sendError(res, 'Email, phone, or license number already registered', 409);
      }
      return sendError(res, err.message || 'Registration failed');
    }
  },

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      return sendSuccess(res, result, 'Login successful');
    } catch (err: any) {
      logger.error('Login error', err);
      return sendError(res, err.message || 'Invalid credentials', 401);
    }
  },

  async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      await authService.logout(req.user!.userId, refreshToken);
      return sendSuccess(res, null, 'Logged out successfully');
    } catch (err: any) {
      return sendError(res, 'Logout failed');
    }
  },

  async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refreshToken(refreshToken);
      return sendSuccess(res, tokens);
    } catch (err: any) {
      return sendError(res, 'Invalid or expired refresh token', 401);
    }
  },

  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      await authService.forgotPassword(email);
      return sendSuccess(res, null, 'If the email exists, a password reset link has been sent');
    } catch (err: any) {
      logger.error('Forgot password error', err);
      return sendSuccess(res, null, 'If the email exists, a password reset link has been sent');
    }
  },

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, new_password } = req.body;
      await authService.resetPassword(token, new_password);
      return sendSuccess(res, null, 'Password reset successfully');
    } catch (err: any) {
      return sendError(res, err.message || 'Password reset failed', 400);
    }
  },

  async verifyEmail(req: Request, res: Response) {
    try {
      const { token } = req.params;
      await authService.verifyEmail(token);
      return sendSuccess(res, null, 'Email verified successfully');
    } catch (err: any) {
      return sendError(res, err.message || 'Invalid verification token', 400);
    }
  },

  async resendVerification(req: Request, res: Response) {
    try {
      const { email } = req.body;
      await authService.resendVerification(email);
      return sendSuccess(res, null, 'Verification email sent');
    } catch (err: any) {
      return sendError(res, 'Failed to resend verification email');
    }
  },

  async getMe(req: Request, res: Response) {
    try {
      const profile = await authService.getProfile(req.user!.userId, req.user!.role);
      return sendSuccess(res, profile);
    } catch (err: any) {
      return sendError(res, 'Failed to fetch profile');
    }
  },
};
