export interface WearableReading {
  id: string;
  patient_id: string;
  recorded_at: string;
  heart_rate?: number;
  spo2?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  temperature_celsius?: number;
  steps?: number;
  sleep_hours?: number;
  stress_level?: number;
  data_source: 'mock' | 'device' | 'manual';
  created_at: string;
}

export interface BaselineMetric {
  id: string;
  patient_id: string;
  metric_name: string;
  baseline_value: number;
  baseline_std_dev: number;
  sample_count?: number;
  calculated_from_days: number;
  last_calculated_at: string;
}

export interface HealthAlert {
  id: string;
  patient_id: string;
  metric_name: string;
  alert_message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  current_value?: number;
  baseline_value?: number;
  percentage_change?: number;
  trend?: string;
  detected_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved_at?: string;
}
