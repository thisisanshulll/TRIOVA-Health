export interface Doctor {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  specialization: string;
  qualification?: string;
  experience_years?: number;
  license_number: string;
  consultation_fee?: number;
  profile_picture_url?: string;
  bio?: string;
  average_consultation_time_minutes: number;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface DoctorAvailability {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
  created_at: string;
}

export interface DoctorUnavailability {
  id: string;
  doctor_id: string;
  unavailable_date: string;
  start_time?: string;
  end_time?: string;
  is_full_day: boolean;
  reason?: string;
  created_at: string;
}
