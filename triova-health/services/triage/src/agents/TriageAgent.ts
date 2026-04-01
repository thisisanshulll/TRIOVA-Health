import OpenAI from 'openai';
import { pool } from '../../../shared/db/pool';
import { EmergencyDetector } from './EmergencyDetector';
import { logger } from '../../../shared/utils/logger';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const QUESTION_BANK: Record<string, any[]> = {
  heart: [
    { key: 'chest_pain', text_en: 'Are you experiencing chest pain or discomfort?', type: 'yes_no', is_critical: true },
    { key: 'pain_duration', text_en: 'How long have you had this chest pain?', type: 'duration', is_critical: false },
    { key: 'pain_radiation', text_en: 'Does the pain spread to your arm, jaw, neck, or back?', type: 'yes_no', is_critical: true },
    { key: 'shortness_of_breath', text_en: 'Are you short of breath?', type: 'yes_no', is_critical: true },
    { key: 'sweating_nausea', text_en: 'Are you sweating or feeling nauseous?', type: 'yes_no', is_critical: false },
    { key: 'heart_history', text_en: 'Do you have a history of heart disease or have you had a heart attack before?', type: 'yes_no', is_critical: false },
    { key: 'current_medications', text_en: 'Are you taking any heart medications? If yes, which ones?', type: 'text', is_critical: false },
  ],
  respiratory: [
    { key: 'breathing_difficulty', text_en: 'Are you having difficulty breathing right now?', type: 'yes_no', is_critical: true },
    { key: 'breathing_severity', text_en: 'On a scale of 1 to 10, how severe is your breathing difficulty?', type: 'scale', is_critical: true },
    { key: 'cough_type', text_en: 'Do you have a cough? Is it dry or bringing up mucus?', type: 'choice', choices: ['No cough', 'Dry cough', 'Wet/productive cough', 'Coughing blood'], is_critical: false },
    { key: 'onset_duration', text_en: 'When did your breathing problems start?', type: 'duration', is_critical: false },
    { key: 'fever', text_en: 'Do you have a fever?', type: 'yes_no', is_critical: false },
    { key: 'asthma_history', text_en: 'Do you have asthma, COPD, or any chronic lung condition?', type: 'yes_no', is_critical: false },
    { key: 'inhaler_use', text_en: 'Have you used an inhaler or nebulizer? Did it help?', type: 'text', is_critical: false },
  ],
  digestive: [
    { key: 'pain_location', text_en: 'Where exactly is your stomach pain? Can you point to the area?', type: 'text', is_critical: false },
    { key: 'pain_severity', text_en: 'Rate your pain from 1 to 10', type: 'scale', is_critical: false },
    { key: 'nausea_vomiting', text_en: 'Are you experiencing nausea or vomiting?', type: 'yes_no', is_critical: false },
    { key: 'blood_in_stool', text_en: 'Have you noticed any blood in your stool or vomit?', type: 'yes_no', is_critical: true },
    { key: 'last_meal', text_en: 'When did you last eat, and what did you have?', type: 'text', is_critical: false },
  ],
  neurological: [
    { key: 'headache_severity', text_en: 'Rate your headache from 1 to 10. Is this the worst headache of your life?', type: 'scale', is_critical: true },
    { key: 'sudden_onset', text_en: 'Did the headache come on suddenly like a thunderclap?', type: 'yes_no', is_critical: true },
    { key: 'vision_changes', text_en: 'Are you having any vision changes, double vision, or vision loss?', type: 'yes_no', is_critical: true },
    { key: 'weakness_numbness', text_en: 'Do you have any weakness or numbness in your face, arm, or leg?', type: 'yes_no', is_critical: true },
    { key: 'speech_difficulty', text_en: 'Are you having difficulty speaking or finding words?', type: 'yes_no', is_critical: true },
  ],
  general: [
    { key: 'main_complaint', text_en: 'Please describe your main problem in your own words', type: 'text', is_critical: false },
    { key: 'duration', text_en: 'How long have you been experiencing this?', type: 'duration', is_critical: false },
    { key: 'severity', text_en: 'On a scale of 1 to 10, how much is this affecting your daily life?', type: 'scale', is_critical: false },
    { key: 'getting_worse', text_en: 'Is it getting better, worse, or staying the same?', type: 'choice', choices: ['Getting better', 'Getting worse', 'Same', 'Comes and goes'], is_critical: false },
    { key: 'current_medications', text_en: 'Are you currently taking any medications? Please list them.', type: 'text', is_critical: false },
    { key: 'allergies', text_en: 'Do you have any known allergies to medications or foods?', type: 'text', is_critical: false },
    { key: 'similar_episodes', text_en: 'Have you experienced this before? If yes, how was it treated?', type: 'text', is_critical: false },
  ],
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  heart: ['chest pain', 'palpitations', 'heart', 'shortness of breath', 'cardiac'],
  respiratory: ['breathing', 'cough', 'asthma', 'wheeze', 'copd', 'inhaler'],
  digestive: ['stomach', 'nausea', 'vomiting', 'diarrhea', 'abdomen', 'bowel'],
  neurological: ['headache', 'dizziness', 'seizure', 'numbness', 'vision'],
};

export class TriageAgent {
  private detector = new EmergencyDetector();

  classifyComplaint(complaint: string): string {
    const lower = complaint.toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some((kw) => lower.includes(kw))) return cat;
    }
    return 'general';
  }

  getNextQuestion(category: string, answeredKeys: string[]) {
    const questions = QUESTION_BANK[category] || QUESTION_BANK.general;
    return questions.find((q) => !answeredKeys.includes(q.key)) || null;
  }

  isComplete(category: string, answeredKeys: string[]): boolean {
    const questions = QUESTION_BANK[category] || QUESTION_BANK.general;
    return questions.every((q) => answeredKeys.includes(q.key));
  }

  detectEmergency(text: string) {
    return this.detector.detectWithKeyword(text);
  }

  async generateSummary(chiefComplaint: string, category: string, responses: Array<{ question: string; answer: string }>) {
    const qAndA = responses.map((r, i) => `${i + 1}. Q: ${r.question}\n   A: ${r.answer}`).join('\n');

    const prompt = `You are a medical triage assistant generating a structured pre-consultation report.

Patient Chief Complaint: ${chiefComplaint}
Condition Category: ${category}

Triage Responses:
${qAndA}

Generate a professional medical triage report in this EXACT JSON format:
{
  "summary": "2-4 sentence clinical summary in professional medical language",
  "key_symptoms": ["symptom 1", "symptom 2"],
  "relevant_history": "any relevant medical history from the responses",
  "recommended_actions": ["action 1", "action 2"],
  "urgency_level": "EMERGENCY | URGENT | ROUTINE",
  "urgency_reasoning": "1-2 sentences explaining the urgency classification"
}

Guidelines:
- EMERGENCY: Immediate life threat (active chest pain, stroke signs, severe breathing difficulty, active bleeding)
- URGENT: Needs care within 24 hours but not immediately life-threatening
- ROUTINE: Can safely wait for regular appointment`;

    let retries = 3;
    while (retries > 0) {
      try {
        const response = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        });
        return JSON.parse(response.choices[0].message.content || '{}');
      } catch (err: any) {
        retries--;
        if (retries === 0) throw err;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  async analyzeImage(imageBase64: string, context: string): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `You are a medical triage assistant. Analyze this medical image uploaded by a patient during triage. Context: ${context}. Describe what you see clinically (rash, wound, swelling, etc.) and note any concerning features. Do NOT diagnose, just describe observations for a doctor to review.` },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
      });
      return response.choices[0].message.content || '';
    } catch (err) {
      logger.error('Image analysis error', err);
      return 'Image analysis unavailable. Doctor should review image directly.';
    }
  }
}
