import { Request, Response } from 'express';
import { analyticsService } from '../services/analytics.service';
import { sendSuccess, sendError } from '../../../shared/utils/response';
import { analyticsQueue } from '../../../shared/queues/queue-definitions';

export const analyticsController = {
  async getPatientDashboard(req: Request, res: Response) {
    try {
      const { patient_id } = req.params;
      const isSelf = req.user!.patientId === patient_id;
      const isDoctor = req.user!.role === 'doctor';
      if (!isSelf && !isDoctor) return sendError(res, 'Forbidden', 403);
      
      const dashboard = await analyticsService.getPatientDashboard(patient_id);
      return sendSuccess(res, dashboard);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async getDoctorDashboard(req: Request, res: Response) {
    try {
      const doctorId = req.user!.doctorId!;
      const dashboard = await analyticsService.getDoctorDashboard(doctorId);
      return sendSuccess(res, dashboard);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async triggerTrendAnalysis(req: Request, res: Response) {
    try {
      const { patient_id } = req.params;
      await analyticsQueue.add('analyzeTrends', { patientId: patient_id, requestedBy: req.user!.userId });
      return sendSuccess(res, null, 'Trend analysis queued in background');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async acknowledgeAlert(req: Request, res: Response) {
    try {
      const alert = await analyticsService.updateAlertStatus(req.params.alert_id, 'acknowledged', req.user!.userId);
      return sendSuccess(res, alert);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async resolveAlert(req: Request, res: Response) {
    try {
      const alert = await analyticsService.updateAlertStatus(req.params.alert_id, 'resolved', req.user!.userId);
      return sendSuccess(res, alert);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }
};
