import OpenAI from 'openai';
import { pool } from '../../../shared/db/pool';
import { logger } from '../../../shared/utils/logger';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class MedicationExtractorAgent {
  async extractAndSave(text: string, patientId: string, doctorId?: string, documentId?: string): Promise<boolean> {
    try {
      const prompt = `You are a medical assistant. Extract ALL current/active medications from the following medical text.
DO NOT include allergies, conditions, or past/discontinued medications. Focus ONLY on currently prescribed or active medications.

Medical Text:
${text}

Return the extracted medications in EXACTLY this JSON format:
{
  "medications": [
    {
      "medication_name": "string",
      "dosage": "string (or null)",
      "frequency": "string (or null)",
      "timing_instructions": "string (or null)",
      "notes": "any special instructions (or null)"
    }
  ]
}
If no active medications are found, return { "medications": [] }.`;

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      });

      const result = JSON.parse(response.choices[0].message.content || '{"medications":[]}');
      const meds = result.medications || [];

      if (meds.length === 0) return false;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        for (const med of meds) {
          // Check if already active to prevent duplicates
          const existing = await client.query(
            `SELECT id FROM patient_medications WHERE patient_id = $1 AND lower(medication_name) = lower($2) AND is_active = TRUE`,
            [patientId, med.medication_name]
          );
          
          if (!existing.rows.length) {
            await client.query(
              `INSERT INTO patient_medications (patient_id, medication_name, dosage, frequency, timing_instructions, start_date, prescribed_by, source, notes)
               VALUES ($1,$2,$3,$4,$5,CURRENT_DATE,$6,'prescription_scan',$7)`,
              [
                patientId, 
                med.medication_name, 
                med.dosage, 
                med.frequency, 
                med.timing_instructions, 
                doctorId || null, 
                med.notes ? `${med.notes} (Extracted from doc ${documentId || 'upload'})` : null
              ]
            );
          }
        }
        
        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err: any) {
      logger.error('Medication extraction failed', err);
      return false; // Soft fail, extraction is a background enhancement
    }
  }
}
