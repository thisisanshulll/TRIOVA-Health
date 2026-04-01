import { pool } from '../../../shared/db/pool';

export const doctorsService = {
  async list(filters: any) {
    let query = `SELECT d.*, u.email FROM doctors d JOIN users u ON d.user_id = u.id WHERE 1=1`;
    const values: any[] = [];
    let idx = 1;
    if (filters.specialization) { query += ` AND d.specialization ILIKE $${idx++}`; values.push(`%${filters.specialization}%`); }
    if (filters.is_available !== undefined) { query += ` AND d.is_available = $${idx++}`; values.push(filters.is_available === 'true'); }
    query += ` ORDER BY d.first_name`;
    const r = await pool.query(query, values);
    return r.rows;
  },

  async getWithAvailability(id: string) {
    const d = await pool.query(`SELECT d.*, u.email FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1`, [id]);
    if (!d.rows.length) return null;
    const avail = await pool.query(`SELECT * FROM doctor_availability WHERE doctor_id = $1 AND is_active = TRUE ORDER BY day_of_week, start_time`, [id]);
    return { doctor: d.rows[0], availability_schedule: avail.rows };
  },

  async update(id: string, dto: any) {
    const allowed = ['bio', 'consultation_fee', 'is_available', 'average_consultation_time_minutes', 'profile_picture_url'];
    const fields = Object.keys(dto).filter((k) => allowed.includes(k));
    if (!fields.length) throw new Error('No valid fields');
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const r = await pool.query(`UPDATE doctors SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...fields.map((f) => dto[f])]);
    return r.rows[0];
  },

  async getDoctorPatients(doctorId: string, filters: any) {
    const r = await pool.query(
      `SELECT DISTINCT p.*, ts.urgency_level, ts.ai_summary, ts.chief_complaint
       FROM patients p
       JOIN appointments a ON a.patient_id = p.id
       LEFT JOIN triage_sessions ts ON ts.patient_id = p.id AND ts.status = 'completed'
       WHERE a.doctor_id = $1 AND a.status NOT IN ('cancelled')
       ORDER BY ts.urgency_level DESC NULLS LAST, p.last_name`,
      [doctorId]
    );
    return { patients: r.rows };
  },

  async createConsultation(dto: any) {
    const appt = await pool.query(`SELECT patient_id FROM appointments WHERE id = $1`, [dto.appointment_id]);
    const patientId = appt.rows[0]?.patient_id || dto.patient_id;

    const r = await pool.query(
      `INSERT INTO consultations (appointment_id, patient_id, doctor_id, triage_session_id, diagnosis, symptoms, prescription_text, tests_recommended, follow_up_date, consultation_notes, doctor_summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [dto.appointment_id, patientId, dto.doctor_id, dto.triage_session_id || null, dto.diagnosis, dto.symptoms, dto.prescription_text, dto.tests_recommended, dto.follow_up_date || null, dto.consultation_notes, dto.doctor_summary]
    );

    // Update appointment status
    await pool.query(`UPDATE appointments SET status = 'completed' WHERE id = $1`, [dto.appointment_id]);
    return r.rows[0];
  },

  async getConsultation(id: string) {
    const c = await pool.query(`SELECT * FROM consultations WHERE id = $1`, [id]);
    if (!c.rows.length) return null;
    const meds = await pool.query(`SELECT * FROM prescribed_medications WHERE consultation_id = $1`, [id]);
    return { consultation: c.rows[0], prescribed_medications: meds.rows };
  },

  async getPatientConsultations(patientId: string) {
    const r = await pool.query(
      `SELECT c.*, d.first_name || ' ' || d.last_name as doctor_name FROM consultations c JOIN doctors d ON c.doctor_id = d.id WHERE c.patient_id = $1 ORDER BY c.created_at DESC`,
      [patientId]
    );
    return r.rows;
  },

  async addPrescribedMedications(consultationId: string, medications: any[]) {
    const meds = [];
    for (const med of medications) {
      const r = await pool.query(
        `INSERT INTO prescribed_medications (consultation_id, medication_name, dosage, frequency, timing, duration_days, instructions) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [consultationId, med.medication_name, med.dosage, med.frequency, med.timing, med.duration_days, med.instructions]
      );
      meds.push(r.rows[0]);
    }
    return meds;
  },
};
