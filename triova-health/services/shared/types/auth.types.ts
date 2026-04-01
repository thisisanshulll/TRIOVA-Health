export interface AuthUser {
  userId: string;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
  patientId?: string;
  doctorId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterPatientDto {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  phone: string;
  preferred_language?: string;
}

export interface RegisterDoctorDto {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  specialization: string;
  license_number: string;
  qualification?: string;
  experience_years?: number;
}

export interface LoginDto {
  email: string;
  password: string;
}
