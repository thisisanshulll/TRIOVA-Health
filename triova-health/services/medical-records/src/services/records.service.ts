import { pool } from '../../../shared/db/pool';

export const recordsService = {
  async createDocument(dto: any) {
    const r = await pool.query(
      `INSERT INTO medical_documents (patient_id, document_type, file_url, file_name, file_size_bytes, mime_type, uploaded_by, document_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [dto.patient_id, dto.document_type, dto.file_url, dto.file_name, dto.file_size_bytes, dto.mime_type, dto.uploaded_by, dto.document_date || null]
    );
    return r.rows[0];
  },

  async listDocuments(patientId: string, filters: any) {
    let q = `SELECT * FROM medical_documents WHERE patient_id = $1`;
    const vals: any[] = [patientId];
    let i = 2;
    if (filters.document_type) { q += ` AND document_type = $${i++}`; vals.push(filters.document_type); }
    if (filters.is_processed) { q += ` AND is_processed = $${i++}`; vals.push(filters.is_processed === 'true'); }
    q += ` ORDER BY created_at DESC LIMIT 50`;
    const r = await pool.query(q, vals);
    return { documents: r.rows, total: r.rows.length };
  },

  async getDocument(id: string) {
    const r = await pool.query(`SELECT * FROM medical_documents WHERE id = $1`, [id]);
    return r.rows[0] || null;
  },

  async deleteDocument(id: string) {
    await pool.query(`DELETE FROM medical_documents WHERE id = $1`, [id]);
  },

  async markProcessed(id: string, extractedText: string) {
    await pool.query(`UPDATE medical_documents SET is_processed = TRUE, extracted_text = $1, processing_error = NULL WHERE id = $2`, [extractedText, id]);
  },

  async markProcessingError(id: string, error: string, retryCount: number) {
    await pool.query(`UPDATE medical_documents SET processing_error = $1, retry_count = $2, is_processed = FALSE WHERE id = $3`, [error, retryCount, id]);
  },

  async saveChatRecord(dto: any) {
    await pool.query(
      `INSERT INTO medical_record_chats (patient_id, queried_by, querier_role, query, response, source_document_ids, confidence_score, session_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [dto.patient_id, dto.queried_by, dto.querier_role, dto.query, dto.response, dto.source_document_ids, dto.confidence_score, dto.session_key]
    );
  },

  async getChatHistory(patientId: string) {
    const r = await pool.query(`SELECT * FROM medical_record_chats WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 50`, [patientId]);
    return r.rows;
  },
};
