import OpenAI from 'openai';
import { pool } from '../../../shared/db/pool';
import { logger } from '../../../shared/utils/logger';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class VoiceBookingAgent {
  async processVoiceBooking(audioBase64: string, patientId: string) {
    // Transcribe audio
    const transcription = await this.transcribeAudio(audioBase64);

    // Extract booking details via GPT
    const extracted = await this.extractBookingDetails(transcription);

    // Check slot availability
    const { doctorId, requestedDate, requestedTime } = extracted;
    let suggestedSlot = null;
    let alternativeSlots: string[] = [];

    if (doctorId && requestedDate && requestedTime) {
      const conflict = await pool.query(
        `SELECT id FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 AND status NOT IN ('cancelled','no_show')`,
        [doctorId, requestedDate, requestedTime]
      );
      if (!conflict.rows.length) {
        suggestedSlot = { date: requestedDate, time: requestedTime };
      } else {
        alternativeSlots = await this.getAlternatives(doctorId, requestedDate, requestedTime);
      }
    }

    return {
      transcription,
      extracted_details: extracted,
      available_slots: suggestedSlot ? [suggestedSlot] : alternativeSlots,
      suggested_appointment: suggestedSlot || (alternativeSlots.length > 0 ? { date: requestedDate, time: alternativeSlots[0] } : null),
      needs_clarification: extracted.needs_clarification || false,
      clarification_prompt: extracted.clarification_prompt,
    };
  }

  private async transcribeAudio(base64: string): Promise<string> {
    if (!base64 || base64.length < 10) return '';
    try {
      // Convert base64 to buffer for Whisper
      const buffer = Buffer.from(base64, 'base64');
      const file = new File([buffer], 'audio.webm', { type: 'audio/webm' });
      const response = await openai.audio.transcriptions.create({
        file,
        model: process.env.OPENAI_WHISPER_MODEL || 'whisper-1',
        language: 'en',
      });
      return response.text;
    } catch (err: any) {
      logger.error('Whisper transcription error', err);
      if (err.message?.includes('audio')) {
        throw { success: false, error: 'audio_quality', fallback: 'text_input' };
      }
      throw err;
    }
  }

  private async extractBookingDetails(transcription: string) {
    const now = new Date().toISOString();
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a medical appointment booking assistant. Extract booking details from patient speech.
Current datetime: ${now}
Return JSON: { "doctorId": null, "requestedDate": "YYYY-MM-DD or null", "requestedTime": "HH:MM:SS or null", "urgency": "routine|urgent|emergency", "chiefComplaint": "string or null", "needs_clarification": boolean, "clarification_prompt": "string or null" }
Rules:
- "next Tuesday" → calculate actual date from current date
- "evening" → 18:00:00, "morning" → 09:00:00, "afternoon" → 14:00:00
- If patient says "emergency" or "urgent" → set urgency
- If date is ambiguous → set needs_clarification=true`,
        },
        { role: 'user', content: transcription },
      ],
    });

    try {
      return JSON.parse(response.choices[0].message.content || '{}');
    } catch {
      return { needs_clarification: true, clarification_prompt: 'Could not understand booking details. Please try again.' };
    }
  }

  private async getAlternatives(doctorId: string, date: string, _time: string): Promise<string[]> {
    const dayOfWeek = new Date(date).getDay();
    const avail = await pool.query(
      `SELECT * FROM doctor_availability WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = TRUE`,
      [doctorId, dayOfWeek]
    );
    const alts: string[] = [];
    for (const a of avail.rows) {
      let t = a.start_time;
      while (t < a.end_time && alts.length < 3) {
        const conflict = await pool.query(
          `SELECT id FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 AND status NOT IN ('cancelled','no_show')`,
          [doctorId, date, t]
        );
        if (!conflict.rows.length) alts.push(t);
        const [h, m] = t.split(':').map(Number);
        const next = new Date(0, 0, 0, h, m + a.slot_duration_minutes, 0);
        t = `${next.getHours().toString().padStart(2, '0')}:${next.getMinutes().toString().padStart(2, '0')}:00`;
      }
    }
    return alts;
  }
}
