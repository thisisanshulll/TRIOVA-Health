import { pool } from '../../../shared/db/pool';

export const analyticsService = {
  async getPatientDashboard(patientId: string) {
    const [latestWearable, recentAlerts, recentTriage, activeMeds, upcomingAppts, healthScore] = await Promise.all([
      pool.query(`SELECT * FROM wearable_data WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT 1`, [patientId]),
      pool.query(`SELECT * FROM health_alerts WHERE patient_id = $1 AND status = 'active' ORDER BY detected_at DESC LIMIT 5`, [patientId]),
      pool.query(`SELECT * FROM triage_sessions WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 3`, [patientId]),
      pool.query(`SELECT * FROM patient_medications WHERE patient_id = $1 AND is_active = TRUE`, [patientId]),
      pool.query(`SELECT a.*, d.first_name as doc_fn, d.last_name as doc_ln, d.specialization FROM appointments a JOIN doctors d ON a.doctor_id = d.id WHERE a.patient_id = $1 AND a.appointment_date >= CURRENT_DATE AND a.status IN ('scheduled', 'confirmed') ORDER BY a.appointment_date, a.appointment_time LIMIT 3`, [patientId]),
      this.calculateHealthScore(patientId) // custom logic
    ]);

    return {
      latest_vitals: latestWearable.rows[0] || null,
      health_score: healthScore,
      active_alerts: recentAlerts.rows,
      recent_triage_sessions: recentTriage.rows,
      active_medications: activeMeds.rows,
      upcoming_appointments: upcomingAppts.rows,
    };
  },

  async getDoctorDashboard(doctorId: string) {
    const today = new Date().toISOString().split('T')[0];
    
    const [todayAppts, pendingTriage, myPatientsAlerts] = await Promise.all([
      pool.query(`SELECT a.*, p.first_name, p.last_name FROM appointments a JOIN patients p ON a.patient_id = p.id WHERE a.doctor_id = $1 AND a.appointment_date = $2 AND a.status NOT IN ('cancelled', 'completed') ORDER BY a.urgency DESC, a.appointment_time`, [doctorId, today]),
      pool.query(`SELECT a.*, p.first_name, p.last_name, ts.urgency_level, ts.ai_summary FROM appointments a JOIN patients p ON a.patient_id = p.id JOIN triage_sessions ts ON ts.appointment_id = a.id WHERE a.doctor_id = $1 AND a.status = 'scheduled' AND ts.status = 'completed' ORDER BY ts.urgency_level DESC NULLS LAST`, [doctorId]),
      pool.query(`SELECT ha.*, p.first_name, p.last_name FROM health_alerts ha JOIN patients p ON ha.patient_id = p.id JOIN appointments a ON a.patient_id = p.id WHERE a.doctor_id = $1 AND ha.status = 'active' AND ha.severity IN ('high', 'critical')`, [doctorId]), // Simplified: showing alerts for patients who have appointments with this doc
    ]);

    const metrics = {
      total_today: todayAppts.rows.length,
      remaining: todayAppts.rows.filter((r: any) => !['completed', 'cancelled', 'no_show'].includes(r.status)).length,
      critical_alerts: myPatientsAlerts.rows.length
    };

    return {
      metrics,
      today_appointments: todayAppts.rows,
      urgent_triage_cases: pendingTriage.rows.filter((r: any) => r.urgency_level === 'emergency' || r.urgency_level === 'urgent'),
      patient_alerts: myPatientsAlerts.rows
    };
  },

  async updateAlertStatus(alertId: string, status: 'acknowledged' | 'resolved', userId: string) {
    const r = await pool.query(
      `UPDATE health_alerts SET status = $1, ${status === 'acknowledged' ? 'acknowledged_at = NOW(), acknowledged_by = $2' : 'resolved_at = NOW()'} WHERE id = $3 RETURNING *`,
      [status, userId, alertId]
    );
    return r.rows[0];
  },

  async calculateHealthScore(patientId: string): Promise<number> {
    // Simple mock logic for Health Score (0-100)
    // Starts at 100, drops for active alerts, bad vitals, chronic conditions
    let score = 100;
    
    const [alerts, vitals, conditions, meds] = await Promise.all([
      pool.query(`SELECT severity FROM health_alerts WHERE patient_id = $1 AND status = 'active'`, [patientId]),
      pool.query(`SELECT * FROM wearable_data WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT 1`, [patientId]),
      pool.query(`SELECT COUNT(*) as count FROM patient_chronic_conditions WHERE patient_id = $1`, [patientId]),
      pool.query(`SELECT COUNT(*) as count FROM patient_medications WHERE patient_id = $1 AND is_active = TRUE`, [patientId])
    ]);

    // Deduct for active alerts
    alerts.rows.forEach(a => {
      if (a.severity === 'critical') score -= 20;
      else if (a.severity === 'high') score -= 10;
      else if (a.severity === 'medium') score -= 5;
    });

    // Deduct for chronic conditions / heavy med load
    score -= (parseInt(conditions.rows[0].count) * 2);
    score -= (parseInt(meds.rows[0].count) * 1);

    // Deduct for bad latest vitals
    const v = vitals.rows[0];
    if (v) {
      if (v.heart_rate > 100 || v.heart_rate < 50) score -= 5;
      if (v.spo2 < 95) score -= 10;
      if (v.blood_pressure_systolic > 140) score -= 5;
      if (v.sleep_hours < 5) score -= 5;
    }

    return Math.max(0, Math.min(100, score)); // Clamp 0-100
  }
};
