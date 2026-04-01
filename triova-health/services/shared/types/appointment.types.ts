export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type UrgencyLevel = 'emergency' | 'urgent' | 'routine';

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  urgency: UrgencyLevel;
  chief_complaint?: string;
  booking_method: 'manual' | 'voice' | 'system';
  booking_notes?: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  queue_position?: number;
  estimated_wait_minutes?: number;
  actual_start_time?: string;
  actual_end_time?: string;
  triage_session_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TimeSlot {
  time: string;
  is_available: boolean;
}

export interface BookAppointmentDto {
  doctor_id: string;
  date: string;
  time: string;
  urgency?: UrgencyLevel;
  chief_complaint?: string;
  booking_notes?: string;
}
