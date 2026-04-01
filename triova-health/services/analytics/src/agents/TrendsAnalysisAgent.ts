import OpenAI from 'openai';
import { pool } from '../../../shared/db/pool';
import { logger } from '../../../shared/utils/logger';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class TrendsAnalysisAgent {
  async analyzePatientTrends(patientId: string): Promise<any> {
    try {
      // 1. Gather all data
      const [patient, trackingData, history, alerts, meds] = await Promise.all([
        pool.query(`SELECT date_of_birth, gender FROM patients WHERE id = $1`, [patientId]),
        pool.query(`SELECT * FROM wearable_data WHERE patient_id = $1 AND recorded_at > NOW() - INTERVAL '30 days' ORDER BY recorded_at ASC`, [patientId]),
        pool.query(`SELECT chief_complaint, ai_summary, urgency_level, created_at FROM triage_sessions WHERE patient_id = $1 AND status = 'completed'`, [patientId]),
        pool.query(`SELECT metric_name, alert_message, severity, detected_at FROM health_alerts WHERE patient_id = $1 ORDER BY detected_at DESC LIMIT 10`, [patientId]),
        pool.query(`SELECT medication_name FROM patient_medications WHERE patient_id = $1 AND is_active = TRUE`, [patientId])
      ]);

      if (trackingData.rows.length < 5) {
        return { 
          status: 'insufficient_data', 
          message: 'Not enough data points yet. Please sync wearable data for at least 5 days.' 
        };
      }

      // Simplify data for GPT context
      const vitalsHistory = trackingData.rows.map(r => ({
        date: r.recorded_at,
        hr: r.heart_rate,
        bp: `${r.blood_pressure_systolic || '-'}/${r.blood_pressure_diastolic || '-'}`,
        spo2: r.spo2,
        sleep: r.sleep_hours
      }));

      const prompt = `You are a medical data analyst AI. Review the last 30 days of patient data and identify health trends, improvements, or deterioration.

Patient Profile: ${patient.rows[0]?.gender || 'Unknown'}, DOB: ${patient.rows[0]?.date_of_birth || 'Unknown'}
Active Medications: ${meds.rows.map((m: any) => m.medication_name).join(', ') || 'None'}

Vitals History (Last 30 days):
${JSON.stringify(vitalsHistory)}

Recent AI Triage Sessions:
${JSON.stringify(history.rows)}

Recent Health Alerts:
${JSON.stringify(alerts.rows)}

Generate a structured JSON analysis:
{
  "overall_trend": "IMPROVING|DETERIORATING|STABLE",
  "key_findings": ["string array of 2-3 main insights"],
  "metrics_analysis": {
    "heart_rate": "string description",
    "blood_pressure": "string description",
    "sleep": "string description"
  },
  "risk_factors_identified": ["string array of emerging risks based on recent data"],
  "preventative_recommendations": ["string array of 2-3 lifestyle/medical recommendations"]
}`;

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      // Save analysis to DB
      await pool.query(
        `INSERT INTO patient_trend_analyses (patient_id, analysis_json, analyzed_at) VALUES ($1, $2, NOW())`,
        [patientId, JSON.stringify(analysis)]
      );

      return { status: 'success', data: analysis };

    } catch (err: any) {
      logger.error(`Trend analysis failed for patient ${patientId}`, err);
      throw err;
    }
  }

  async recalculateBaselines(patientId: string) {
    // Calculates rolling mathematical baselines for anomaly detection
    const data = await pool.query(
      `SELECT heart_rate, spo2, blood_pressure_systolic, sleep_hours FROM wearable_data 
       WHERE patient_id = $1 AND recorded_at > NOW() - INTERVAL '14 days'`, 
      [patientId]
    );

    if (data.rows.length < 5) return;

    const metrics = ['heart_rate', 'spo2', 'blood_pressure_systolic', 'sleep_hours'];
    
    for (const metric of metrics) {
      const validVals = data.rows.map(r => r[metric]).filter(v => v !== null && v !== undefined);
      if (validVals.length < 5) continue;

      const sum = validVals.reduce((a, b) => a + b, 0);
      const mean = sum / validVals.length;
      
      const squareDiffs = validVals.map(val => Math.pow(val - mean, 2));
      const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
      const stdDev = Math.sqrt(avgSquareDiff);

      // Upsert baseline
      await pool.query(
        `INSERT INTO patient_baselines (patient_id, metric_name, baseline_value, baseline_std_dev, sample_count, calculated_from_days, last_calculated_at)
         VALUES ($1, $2, $3, $4, $5, 14, NOW())
         ON CONFLICT (patient_id, metric_name) 
         DO UPDATE SET baseline_value = $3, baseline_std_dev = $4, sample_count = $5, last_calculated_at = NOW()`,
        [patientId, metric, mean, stdDev, validVals.length]
      );
    }
  }
}
