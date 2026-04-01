import { pool } from '../../../shared/db/pool';
import { logger } from '../../../shared/utils/logger';
import { randomIncrement } from '../../../shared/utils/date-helpers'; // Assuming we create this simple helper

export const wearablesService = {
  async recordReading(dto: any) {
    const r = await pool.query(
      `INSERT INTO wearable_data (patient_id, heart_rate, spo2, blood_pressure_systolic, blood_pressure_diastolic, temperature_celsius, steps, sleep_hours, stress_level, data_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [dto.patient_id, dto.heart_rate, dto.spo2, dto.blood_pressure_systolic, dto.blood_pressure_diastolic, dto.temperature_celsius, dto.steps, dto.sleep_hours, dto.stress_level, dto.data_source || 'device']
    );
    return r.rows[0];
  },

  async getLatestReading(patientId: string) {
    const r = await pool.query(`SELECT * FROM wearable_data WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT 1`, [patientId]);
    return r.rows[0];
  },

  async getHistory(patientId: string, days: number = 7) {
    const r = await pool.query(
      `SELECT * FROM wearable_data WHERE patient_id = $1 AND recorded_at > NOW() - INTERVAL '${days} days' ORDER BY recorded_at ASC`,
      [patientId]
    );
    return r.rows;
  },

  async checkAnomalies(reading: any) {
    const baselines = await pool.query(`SELECT * FROM patient_baselines WHERE patient_id = $1`, [reading.patient_id]);
    
    // Quick checks for critical thresholds (independent of baseline logic for immediate safety)
    if (reading.heart_rate > 120 || reading.heart_rate < 45) {
      await this.createAlert(reading.patient_id, 'heart_rate', reading.heart_rate, 'high', `Critical heart rate detected: ${reading.heart_rate} bpm`);
    }
    
    if (reading.spo2 && reading.spo2 < 92) {
      await this.createAlert(reading.patient_id, 'spo2', reading.spo2, 'critical', `Dangerous blood oxygen level: ${reading.spo2}%`);
    }
    
    if (reading.blood_pressure_systolic > 180 || reading.blood_pressure_diastolic > 120) {
      await this.createAlert(reading.patient_id, 'blood_pressure', reading.blood_pressure_systolic, 'critical', `Hypertensive crisis: ${reading.blood_pressure_systolic}/${reading.blood_pressure_diastolic}`);
    }

    // Baseline deviation checks
    for (const b of baselines.rows) {
      const val = reading[b.metric_name];
      if (val === undefined || val === null) continue;

      const deviation = Math.abs(val - b.baseline_value);
      if (deviation > b.baseline_std_dev * 3) { // 3 sigma
        const percentChange = ((val - b.baseline_value) / b.baseline_value) * 100;
        await this.createAlert(
          reading.patient_id, 
          b.metric_name, 
          val, 
          'high',
          `Significant deviation in ${b.metric_name}: ${val} (Baseline: ${b.baseline_value})`, 
          b.baseline_value, 
          percentChange
        );
      }
    }
  },

  async createAlert(patientId: string, metric: string, value: number, severity: string, message: string, baseline?: number, change?: number) {
    // Deduplication check: Avoid spamming the same alert within 4 hours
    const recent = await pool.query(
      `SELECT id FROM health_alerts WHERE patient_id = $1 AND metric_name = $2 AND status = 'active' AND detected_at > NOW() - INTERVAL '4 hours'`,
      [patientId, metric]
    );
    if (recent.rows.length > 0) return; // Skip if similar alert active recently

    const r = await pool.query(
      `INSERT INTO health_alerts (patient_id, metric_name, alert_message, severity, current_value, baseline_value, percentage_change, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'active') RETURNING *`,
      [patientId, metric, message, severity, value, baseline || null, change || null]
    );

    logger.warn(`Health Alert Created: Patient ${patientId} | ${message} | Severity: ${severity}`);
    
    // In production: trigger realtime socket push and emergency notification queue
  }
};
