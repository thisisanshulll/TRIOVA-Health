import { Request, Response } from 'express';
import { patientsService } from '../services/patients.service';
import { sendSuccess, sendError } from '../../../shared/utils/response';

export const patientsController = {
  async getPatient(req: Request, res: Response) {
    try {
      const isSelf = req.user!.patientId === req.params.id;
      const isDoctor = req.user!.role === 'doctor';
      if (!isSelf && !isDoctor) return sendError(res, 'Forbidden', 403);
      const patient = await patientsService.getFullProfile(req.params.id);
      if (!patient) return sendError(res, 'Patient not found', 404);
      return sendSuccess(res, patient);
    } catch (err: any) { return sendError(res, err.message); }
  },

  async updatePatient(req: Request, res: Response) {
    try {
      if (req.user!.patientId !== req.params.id) return sendError(res, 'Forbidden', 403);
      const patient = await patientsService.update(req.params.id, req.body);
      return sendSuccess(res, { patient });
    } catch (err: any) { return sendError(res, err.message); }
  },

  async addAllergy(req: Request, res: Response) {
    try {
      const allergy = await patientsService.addAllergy(req.params.id, req.body);
      return sendSuccess(res, { allergy }, undefined, 201);
    } catch (err: any) { return sendError(res, err.message); }
  },

  async removeAllergy(req: Request, res: Response) {
    try {
      await patientsService.removeAllergy(req.params.allergy_id);
      return sendSuccess(res, null, 'Allergy removed');
    } catch (err: any) { return sendError(res, err.message); }
  },

  async addCondition(req: Request, res: Response) {
    try {
      const condition = await patientsService.addCondition(req.params.id, req.body);
      return sendSuccess(res, { condition }, undefined, 201);
    } catch (err: any) { return sendError(res, err.message); }
  },

  async removeCondition(req: Request, res: Response) {
    try {
      await patientsService.removeCondition(req.params.condition_id);
      return sendSuccess(res, null, 'Condition removed');
    } catch (err: any) { return sendError(res, err.message); }
  },

  async addMedication(req: Request, res: Response) {
    try {
      const med = await patientsService.addMedication(req.params.id, req.body);
      return sendSuccess(res, { medication: med }, undefined, 201);
    } catch (err: any) { return sendError(res, err.message); }
  },

  async updateMedication(req: Request, res: Response) {
    try {
      const med = await patientsService.updateMedication(req.params.medication_id, req.body);
      return sendSuccess(res, { medication: med });
    } catch (err: any) { return sendError(res, err.message); }
  },

  async getFullHistory(req: Request, res: Response) {
    try {
      const isSelf = req.user!.patientId === req.params.id;
      const isDoctor = req.user!.role === 'doctor';
      if (!isSelf && !isDoctor) return sendError(res, 'Forbidden', 403);
      const history = await patientsService.getFullHistory(req.params.id);
      return sendSuccess(res, history);
    } catch (err: any) { return sendError(res, err.message); }
  },
};
