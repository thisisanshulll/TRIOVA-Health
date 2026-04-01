import { pool } from '../../../shared/db/pool';

export const triageService = {
  async createSession(patientId: string, chiefComplaint: string, category: string, language: string) {
    const r = await pool.query(
      `INSERT INTO triage_sessions (patient_id, chief_complaint, condition_category, language, status)
       VALUES ($1, $2, $3, $4, 'in_progress') RETURNING *`,
      [patientId, chiefComplaint, category, language]
    );
    return r.rows[0];
  },

  async getSession(id: string) {
    const r = await pool.query(`SELECT * FROM triage_sessions WHERE id = $1`, [id]);
    return r.rows[0];
  },

  async getActiveSession(patientId: string) {
    const r = await pool.query(
      `SELECT * FROM triage_sessions WHERE patient_id = $1 AND status = 'in_progress' AND started_at > NOW() - INTERVAL '24 hours' ORDER BY started_at DESC LIMIT 1`,
      [patientId]
    );
    return r.rows[0] || null;
  },

  async saveResponse(sessionId: string, questionKey: string, responseText: string, responseValue: any, isEmergency: boolean) {
    const order = await pool.query(`SELECT COUNT(*) as cnt FROM triage_responses WHERE triage_session_id = $1`, [sessionId]);
    const q = await pool.query(`SELECT question_text_en FROM triage_question_bank WHERE question_key = $1 LIMIT 1`, [questionKey]);
    const questionText = q.rows[0]?.question_text_en || questionKey;

    await pool.query(
      `INSERT INTO triage_responses (triage_session_id, question_key, question_text, response_text, response_value, is_emergency_flag, response_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sessionId, questionKey, questionText, responseText, responseValue ? JSON.stringify(responseValue) : null, isEmergency, parseInt(order.rows[0].cnt) + 1]
    );
  },

  async getAnsweredKeys(sessionId: string): Promise<string[]> {
    const r = await pool.query(`SELECT question_key FROM triage_responses WHERE triage_session_id = $1`, [sessionId]);
    return r.rows.map((row: any) => row.question_key);
  },

  async getAllResponses(sessionId: string) {
    const r = await pool.query(`SELECT question_text, response_text FROM triage_responses WHERE triage_session_id = $1 ORDER BY response_order`, [sessionId]);
    return r.rows.map((row: any) => ({ question: row.question_text, answer: row.response_text }));
  },

  async completeSesssion(sessionId: string, summary: any) {
    const urgency = summary.urgency_level?.toLowerCase() as 'emergency' | 'urgent' | 'routine';
    await pool.query(
      `UPDATE triage_sessions SET status = 'completed', urgency_level = $1, ai_summary = $2, key_symptoms = $3, recommended_actions = $4, completed_at = NOW() WHERE id = $5`,
      [urgency, summary.summary, summary.key_symptoms, summary.recommended_actions, sessionId]
    );
  },

  async markEmergency(sessionId: string) {
    await pool.query(
      `UPDATE triage_sessions SET urgency_level = 'emergency', status = 'completed', completed_at = NOW() WHERE id = $1`,
      [sessionId]
    );
  },

  async abandonSession(sessionId: string) {
    await pool.query(`UPDATE triage_sessions SET status = 'abandoned' WHERE id = $1`, [sessionId]);
  },

  async saveImage(sessionId: string, imageUrl: string, analysis: string) {
    const r = await pool.query(
      `INSERT INTO triage_images (triage_session_id, image_url, ai_analysis) VALUES ($1, $2, $3) RETURNING *`,
      [sessionId, imageUrl, analysis]
    );
    return r.rows[0];
  },

  async getFullSummary(sessionId: string) {
    const session = await pool.query(`SELECT * FROM triage_sessions WHERE id = $1`, [sessionId]);
    if (!session.rows.length) return null;
    const responses = await pool.query(`SELECT * FROM triage_responses WHERE triage_session_id = $1 ORDER BY response_order`, [sessionId]);
    return { ...session.rows[0], responses: responses.rows };
  },

  async getPatientHistory(patientId: string) {
    const r = await pool.query(
      `SELECT * FROM triage_sessions WHERE patient_id = $1 ORDER BY started_at DESC LIMIT 20`,
      [patientId]
    );
    return r.rows;
  },

  async cleanupAbandoned() {
    await pool.query(`UPDATE triage_sessions SET status = 'abandoned' WHERE status = 'in_progress' AND started_at < NOW() - INTERVAL '24 hours'`);
  },
};
