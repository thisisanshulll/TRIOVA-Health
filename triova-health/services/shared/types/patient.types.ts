export interface Patient {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  blood_group?: string;
  height_cm?: number;
  weight_kg?: number;
  profile_picture_url?: string;
  preferred_language: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientAllergy {
  id: string;
  patient_id: string;
  allergen: string;
  severity: 'mild' | 'moderate' | 'severe';
  reaction_description?: string;
  diagnosed_date?: string;
  created_at: string;
}

export interface PatientChronicCondition {
  id: string;
  patient_id: string;
  condition_name: string;
  icd_code?: string;
  diagnosed_date?: string;
  notes?: string;
  created_at: string;
}

export interface PatientMedication {
  id: string;
  patient_id: string;
  medication_name: string;
  dosage?: string;
  frequency?: string;
  timing_instructions?: string;
  start_date: string;
  end_date?: string;
  prescribed_by?: string;
  source: 'manual' | 'prescription_scan' | 'consultation';
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}
