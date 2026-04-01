export type TriageStatus = 'in_progress' | 'completed' | 'abandoned';
export type TriageUrgency = 'emergency' | 'urgent' | 'routine';

export interface TriageSession {
  id: string;
  patient_id: string;
  appointment_id?: string;
  status: TriageStatus;
  language: string;
  chief_complaint?: string;
  condition_category?: string;
  urgency_level?: TriageUrgency;
  ai_summary?: string;
  key_symptoms?: string[];
  recommended_actions?: string[];
  risk_flags?: string[];
  started_at: string;
  completed_at?: string;
  created_at: string;
}

export interface TriageQuestion {
  key: string;
  text_en: string;
  text_hi?: string;
  type: 'text' | 'yes_no' | 'scale' | 'choice' | 'duration';
  choices?: string[];
  is_critical: boolean;
}

export interface TriageResponse {
  id: string;
  triage_session_id: string;
  question_key: string;
  question_text: string;
  response_text?: string;
  response_value?: any;
  is_emergency_flag: boolean;
  response_order: number;
  created_at: string;
}

export interface TriageSummary {
  summary: string;
  key_symptoms: string[];
  relevant_history: string;
  recommended_actions: string[];
  urgency_level: 'EMERGENCY' | 'URGENT' | 'ROUTINE';
  urgency_reasoning: string;
}
