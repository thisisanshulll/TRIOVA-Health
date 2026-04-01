import { Request, Response } from 'express';
import { wearablesService } from '../services/wearables.service';
import { sendSuccess, sendError } from '../../../shared/utils/response';
import { logger } from '../../../shared/utils/logger';

export const wearablesController = {
  async syncData(req: Request, res: Response) {
    try {
      const patientId = req.user!.patientId!;
      const data = await wearablesService.recordReading({ ...req.body, patient_id: patientId });
      
      // Check for immediate anomalies against baselines
      await wearablesService.checkAnomalies(data);
      
      return sendSuccess(res, data, 'Data synced successfully', 201);
    } catch (err: any) {
      logger.error('Sync wearable data error', err);
      return sendError(res, err.message);
    }
  },

  async getLatest(req: Request, res: Response) {
    try {
      const { patient_id } = req.params;
      const isSelf = req.user!.patientId === patient_id;
      const isDoctor = req.user!.role === 'doctor';
      if (!isSelf && !isDoctor) return sendError(res, 'Forbidden', 403);
      
      const latest = await wearablesService.getLatestReading(patient_id);
      return sendSuccess(res, latest || {});
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async getHistory(req: Request, res: Response) {
    try {
      const { patient_id } = req.params;
      const { days = 7 } = req.query;
      const history = await wearablesService.getHistory(patient_id, Number(days));
      return sendSuccess(res, history);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async simulateAnomaly(req: Request, res: Response) {
    try {
      const patientId = req.user!.patientId! || req.body.patient_id;
      const data = await wearablesService.recordReading({ ...req.body, patient_id: patientId, data_source: 'mock' });
      await wearablesService.checkAnomalies(data);
      return sendSuccess(res, data, 'Anomaly simulated', 201);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }
};
