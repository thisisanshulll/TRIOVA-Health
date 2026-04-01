import { Request, Response } from 'express';
import { doctorsService } from '../services/doctors.service';
import { sendSuccess, sendError } from '../../../shared/utils/response';

export const doctorsController = {
  async listDoctors(req: Request, res: Response) {
    try {
      const doctors = await doctorsService.list(req.query as any);
      return sendSuccess(res, { doctors });
    } catch (err: any) { return sendError(res, err.message); }
  },

  async getDoctor(req: Request, res: Response) {
    try {
      const doctor = await doctorsService.getWithAvailability(req.params.id);
      if (!doctor) return sendError(res, 'Doctor not found', 404);
      return sendSuccess(res, doctor);
    } catch (err: any) { return sendError(res, err.message); }
  },

  async updateDoctor(req: Request, res: Response) {
    try {
      if (req.user!.doctorId !== req.params.id) return sendError(res, 'Forbidden', 403);
      const doctor = await doctorsService.update(req.params.id, req.body);
      return sendSuccess(res, { doctor });
    } catch (err: any) { return sendError(res, err.message); }
  },

  async getDoctorPatients(req: Request, res: Response) {
    try {
      const patients = await doctorsService.getDoctorPatients(req.params.id, req.query as any);
      return sendSuccess(res, patients);
    } catch (err: any) { return sendError(res, err.message); }
  },

  async createConsultation(req: Request, res: Response) {
    try {
      const consultation = await doctorsService.createConsultation({ ...req.body, doctor_id: req.user!.doctorId });
      return sendSuccess(res, { consultation }, undefined, 201);
    } catch (err: any) { return sendError(res, err.message); }
  },

  async getConsultation(req: Request, res: Response) {
    try {
      const consultation = await doctorsService.getConsultation(req.params.id);
      if (!consultation) return sendError(res, 'Not found', 404);
      return sendSuccess(res, consultation);
    } catch (err: any) { return sendError(res, err.message); }
  },

  async getPatientConsultations(req: Request, res: Response) {
    try {
      const consultations = await doctorsService.getPatientConsultations(req.params.patient_id);
      return sendSuccess(res, { consultations });
    } catch (err: any) { return sendError(res, err.message); }
  },

  async addPrescribedMedications(req: Request, res: Response) {
    try {
      const meds = await doctorsService.addPrescribedMedications(req.params.id, req.body.medications);
      return sendSuccess(res, { prescribed_medications: meds }, undefined, 201);
    } catch (err: any) { return sendError(res, err.message); }
  },
};
