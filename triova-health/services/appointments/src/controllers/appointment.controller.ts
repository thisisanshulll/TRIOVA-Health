import { Request, Response } from 'express';
import { appointmentService } from '../services/appointment.service';
import { availabilityService } from '../services/availability.service';
import { VoiceBookingAgent } from '../agents/VoiceBookingAgent';
import { sendSuccess, sendError } from '../../../shared/utils/response';
import { isPast2HoursBefore } from '../../../shared/utils/date-helpers';
import { logger } from '../../../shared/utils/logger';

export const appointmentController = {
  async voiceBooking(req: Request, res: Response) {
    try {
      const { audio_base64 } = req.body;
      const patientId = req.user!.patientId!;
      const agent = new VoiceBookingAgent();
      const result = await agent.processVoiceBooking(audio_base64, patientId);
      return sendSuccess(res, result);
    } catch (err: any) {
      logger.error('Voice booking error', err);
      return sendError(res, err.message || 'Voice booking failed');
    }
  },

  async bookAppointment(req: Request, res: Response) {
    try {
      const patientId = req.user!.patientId!;
      const appointment = await appointmentService.bookAppointment({ ...req.body, patient_id: patientId });
      return sendSuccess(res, appointment, 'Appointment booked successfully', 201);
    } catch (err: any) {
      logger.error('Book appointment error', err);
      if (err.code === '23505' || err.message?.includes('already booked')) {
        const alternatives = await appointmentService.getAlternativeSlots(req.body.doctor_id, req.body.date, req.body.time);
        return sendError(res, `Slot already booked. Here are alternatives: ${JSON.stringify(alternatives)}`, 409);
      }
      return sendError(res, err.message || 'Booking failed');
    }
  },

  async getAvailableSlots(req: Request, res: Response) {
    try {
      const { doctor_id, date, urgency } = req.query as any;
      const slots = await availabilityService.getAvailableSlots(doctor_id, date, urgency);
      return sendSuccess(res, { slots });
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async getNextAvailable(req: Request, res: Response) {
    try {
      const { doctor_id, from_date, urgency } = req.query as any;
      const slot = await availabilityService.getNextAvailableSlot(doctor_id, from_date, urgency);
      return sendSuccess(res, { next_slot: slot });
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async getPatientAppointments(req: Request, res: Response) {
    try {
      const { patient_id } = req.params;
      const isSelf = req.user!.patientId === patient_id;
      const isDoctor = req.user!.role === 'doctor';
      if (!isSelf && !isDoctor) return sendError(res, 'Forbidden', 403);
      const result = await appointmentService.getPatientAppointments(patient_id, req.query as any);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async getDoctorAppointments(req: Request, res: Response) {
    try {
      const { doctor_id } = req.params;
      const result = await appointmentService.getDoctorAppointments(doctor_id, req.query as any);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async updateStatus(req: Request, res: Response) {
    try {
      const appointment = await appointmentService.updateStatus(req.params.id, req.body.status, req.body.cancellation_reason);
      return sendSuccess(res, { appointment });
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async cancelAppointment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const appt = await appointmentService.getById(id);
      if (!appt) return sendError(res, 'Appointment not found', 404);

      const isSelf = req.user!.patientId === appt.patient_id;
      const isDoctor = req.user!.role === 'doctor';

      if (isSelf && isPast2HoursBefore(appt.appointment_date, appt.appointment_time)) {
        return sendError(res, 'Appointments can only be cancelled up to 2 hours before the scheduled time. Please contact your doctor\'s office directly.', 400);
      }

      if (!isSelf && !isDoctor) return sendError(res, 'Forbidden', 403);

      const updated = await appointmentService.cancelAppointment(id, reason, req.user!.userId);
      return sendSuccess(res, { appointment: updated });
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async getQueueStatus(req: Request, res: Response) {
    try {
      const status = await appointmentService.getQueueStatus(req.params.id);
      return sendSuccess(res, status);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async setAvailability(req: Request, res: Response) {
    try {
      const doctorId = req.user!.doctorId!;
      const avail = await availabilityService.setAvailability({ ...req.body, doctor_id: doctorId });
      return sendSuccess(res, { availability: avail }, undefined, 201);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async updateAvailability(req: Request, res: Response) {
    try {
      const avail = await availabilityService.updateAvailability(req.params.id, req.body);
      return sendSuccess(res, { availability: avail });
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async setUnavailability(req: Request, res: Response) {
    try {
      const doctorId = req.user!.doctorId!;
      const unavail = await availabilityService.setUnavailability({ ...req.body, doctor_id: doctorId });
      return sendSuccess(res, { unavailability: unavail }, undefined, 201);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },
};
