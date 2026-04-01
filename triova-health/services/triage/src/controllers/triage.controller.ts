import { Request, Response } from 'express';
import { triageService } from '../services/triage.service';
import { TriageAgent } from '../agents/TriageAgent';
import { sendSuccess, sendError } from '../../../shared/utils/response';
import { logger } from '../../../shared/utils/logger';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const triageController = {
  async startSession(req: Request, res: Response) {
    try {
      const patientId = req.user!.patientId!;
      const { chief_complaint, language } = req.body;

      // Check for existing in-progress session
      const existing = await triageService.getActiveSession(patientId);
      if (existing) {
        const answeredKeys = await triageService.getAnsweredKeys(existing.id);
        const agent = new TriageAgent();
        const question = agent.getNextQuestion(existing.condition_category || 'general', answeredKeys);
        return sendSuccess(res, { session_id: existing.id, existing: true, condition_category: existing.condition_category, next_question: question });
      }

      const agent = new TriageAgent();
      const category = agent.classifyComplaint(chief_complaint);
      const { isEmergency } = agent.detectEmergency(chief_complaint);

      const session = await triageService.createSession(patientId, chief_complaint, category, language || 'en');

      if (isEmergency) {
        await triageService.markEmergency(session.id);
        return sendSuccess(res, { session_id: session.id, is_emergency: true, urgency: 'emergency', message: 'Emergency detected. Please call emergency services immediately.' });
      }

      const questions = agent.getNextQuestion(category, []);
      return sendSuccess(res, { session_id: session.id, condition_category: category, first_question: questions }, undefined, 201);
    } catch (err: any) {
      logger.error('Start triage error', err);
      return sendError(res, err.message);
    }
  },

  async submitAnswer(req: Request, res: Response) {
    try {
      const { session_id, question_key, response_text, response_value } = req.body;
      const session = await triageService.getSession(session_id);
      if (!session) return sendError(res, 'Session not found', 404);

      const agent = new TriageAgent();
      const { isEmergency, keyword } = agent.detectEmergency(response_text || '');

      await triageService.saveResponse(session_id, question_key, response_text, response_value, isEmergency);

      if (isEmergency) {
        await triageService.markEmergency(session_id);
        return sendSuccess(res, { is_emergency: true, urgency: 'emergency', message: `Emergency keyword detected: "${keyword}". Please seek immediate medical help.` });
      }

      const answeredKeys = await triageService.getAnsweredKeys(session_id);
      const isComplete = agent.isComplete(session.condition_category || 'general', answeredKeys);

      if (isComplete) {
        const responses = await triageService.getAllResponses(session_id);
        const summary = await agent.generateSummary(session.chief_complaint || '', session.condition_category || 'general', responses);
        await triageService.completeSesssion(session_id, summary);
        return sendSuccess(res, { is_complete: true, summary, urgency: summary.urgency_level?.toLowerCase() });
      }

      const nextQuestion = agent.getNextQuestion(session.condition_category || 'general', answeredKeys);
      return sendSuccess(res, { next_question: nextQuestion, is_complete: false, is_emergency: false });
    } catch (err: any) {
      logger.error('Submit answer error', err);
      return sendError(res, err.message);
    }
  },

  async voiceAnswer(req: Request, res: Response) {
    try {
      const { session_id, audio_base64 } = req.body;
      if (!audio_base64) return sendError(res, 'No audio provided', 400);

      const buffer = Buffer.from(audio_base64, 'base64');
      const file = new File([buffer], 'audio.webm', { type: 'audio/webm' });
      const transcriptionResp = await openai.audio.transcriptions.create({ file, model: 'whisper-1' });
      const transcription = transcriptionResp.text;

      if (!transcription || transcription.split(' ').length < 2) {
        return sendError(res, JSON.stringify({ success: false, error: 'audio_quality', fallback: 'text_input' }), 400);
      }

      req.body = { session_id, question_key: req.body.question_key, response_text: transcription };
      const result = await triageController.submitAnswer(req, res);
      return result;
    } catch (err: any) {
      logger.error('Voice answer error', err);
      return sendError(res, err.message);
    }
  },

  async uploadImage(req: Request, res: Response) {
    try {
      const { session_id } = req.body;
      if (!req.file) return sendError(res, 'No image uploaded', 400);

      const base64 = req.file.buffer.toString('base64');
      const agent = new TriageAgent();
      const session = await triageService.getSession(session_id);
      const analysis = await agent.analyzeImage(base64, session?.chief_complaint || '');

      const imageRecord = await triageService.saveImage(session_id, `data:${req.file.mimetype};base64,...`, analysis);
      return sendSuccess(res, { image_id: imageRecord.id, ai_analysis: analysis });
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async getSummary(req: Request, res: Response) {
    try {
      const summary = await triageService.getFullSummary(req.params.session_id);
      if (!summary) return sendError(res, 'Session not found', 404);
      return sendSuccess(res, summary);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async getHistory(req: Request, res: Response) {
    try {
      const { patient_id } = req.params;
      const isSelf = req.user!.patientId === patient_id;
      const isDoctor = req.user!.role === 'doctor';
      if (!isSelf && !isDoctor) return sendError(res, 'Forbidden', 403);
      const sessions = await triageService.getPatientHistory(patient_id);
      return sendSuccess(res, { sessions, total: sessions.length });
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async getQuestions(req: Request, res: Response) {
    const { condition_category } = req.query as { condition_category: string };
    const { QUESTION_BANK } = await import('../agents/TriageAgent');
    const questions = QUESTION_BANK[condition_category] || QUESTION_BANK.general;
    return sendSuccess(res, { questions });
  },

  async abandonSession(req: Request, res: Response) {
    try {
      await triageService.abandonSession(req.params.session_id);
      return sendSuccess(res, null, 'Triage session abandoned');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async getActiveSession(req: Request, res: Response) {
    try {
      const patientId = req.user!.patientId!;
      const session = await triageService.getActiveSession(patientId);
      return sendSuccess(res, session || null);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },
};
