import { pool } from '../../../shared/db/pool';

export const patientsService = {
  async getFullProfile(id: string) {
    const p = await pool.query(`SELECT * FROM patients WHERE id = $1`, [id]);
    if (!p.rows.length) return null;
    const [allergies, conditions, meds] = await Promise.all([
      pool.query(`SELECT * FROM patient_allergies WHERE patient_id = $1`, [id]),
      pool.query(`SELECT * FROM patient_chronic_conditions WHERE patient_id = $1`, [id]),
      pool.query(`SELECT * FROM patient_medications WHERE patient_id = $1 AND is_active = TRUE ORDER BY created_at DESC`, [id]),
    ]);
    return { patient: p.rows[0], allergies: allergies.rows, chronic_conditions: conditions.rows, active_medications: meds.rows };
  },

  async update(id: string, dto: any) {
    const allowed = ['first_name','last_name','phone','height_cm','weight_kg','preferred_language','emergency_contact_name','emergency_contact_phone','blood_group','profile_picture_url'];
    const fields = Object.keys(dto).filter((k) => allowed.includes(k));
    if (!fields.length) throw new Error('No valid fields to update');
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map((f) => dto[f]);
    const r = await pool.query(`UPDATE patients SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...values]);
    return r.rows[0];
  },

  async addAllergy(patientId: string, dto: any) {
    const r = await pool.query(
      `INSERT INTO patient_allergies (patient_id, allergen, severity, reaction_description, diagnosed_date) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [patientId, dto.allergen, dto.severity, dto.reaction_description || null, dto.diagnosed_date || null]
    );
    return r.rows[0];
  },

  async removeAllergy(id: string) {
    await pool.query(`DELETE FROM patient_allergies WHERE id = $1`, [id]);
  },

  async addCondition(patientId: string, dto: any) {
    const r = await pool.query(
      `INSERT INTO patient_chronic_conditions (patient_id, condition_name, icd_code, diagnosed_date, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [patientId, dto.condition_name, dto.icd_code || null, dto.diagnosed_date || null, dto.notes || null]
    );
    return r.rows[0];
  },

  async removeCondition(id: string) {
    await pool.query(`DELETE FROM patient_chronic_conditions WHERE id = $1`, [id]);
  },

  async addMedication(patientId: string, dto: any) {
    const r = await pool.query(
      `INSERT INTO patient_medications (patient_id, medication_name, dosage, frequency, timing_instructions, start_date, end_date, prescribed_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [patientId, dto.medication_name, dto.dosage, dto.frequency, dto.timing_instructions, dto.start_date, dto.end_date || null, dto.prescribed_by || null]
    );
    return r.rows[0];
  },

  async updateMedication(id: string, dto: any) {
    const fields = Object.keys(dto).filter((k) => ['is_active','end_date','notes'].includes(k));
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map((f) => dto[f]);
    const r = await pool.query(`UPDATE patient_medications SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...values]);
    return r.rows[0];
  },

  async getFullHistory(patientId: string) {
    const [patient, allergies, conditions, medications, triageSessions, consultations, wearables, alerts] = await Promise.all([
      pool.query(`SELECT * FROM patients WHERE id = $1`, [patientId]),
      pool.query(`SELECT * FROM patient_allergies WHERE patient_id = $1`, [patientId]),
      pool.query(`SELECT * FROM patient_chronic_conditions WHERE patient_id = $1`, [patientId]),
      pool.query(`SELECT * FROM patient_medications WHERE patient_id = $1 ORDER BY created_at DESC`, [patientId]),
      pool.query(`SELECT * FROM triage_sessions WHERE patient_id = $1 ORDER BY started_at DESC LIMIT 5`, [patientId]),
      pool.query(`SELECT c.*, d.first_name || ' ' || d.last_name as doctor_name FROM consultations c JOIN doctors d ON c.doctor_id = d.id WHERE c.patient_id = $1 ORDER BY c.created_at DESC`, [patientId]),
      pool.query(`SELECT * FROM wearable_data WHERE patient_id = $1 AND recorded_at > NOW() - INTERVAL '30 days' ORDER BY recorded_at`, [patientId]),
      pool.query(`SELECT * FROM health_alerts WHERE patient_id = $1 AND status = 'active' ORDER BY detected_at DESC`, [patientId]),
    ]);
    return {
      patient: patient.rows[0],
      allergies: allergies.rows,
      chronic_conditions: conditions.rows,
      medications: medications.rows,
      triage_sessions: triageSessions.rows,
      consultations: consultations.rows,
      wearable_data: wearables.rows,
      active_alerts: alerts.rows,
    };
  },
};
