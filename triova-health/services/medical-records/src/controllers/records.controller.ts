import { Request, Response } from 'express';
import { recordsService } from '../services/records.service';
import { MedicalRAG } from '../rag/MedicalRAG';
import { exportMedicalHistory } from '../services/pdf-export.service';
import { sendSuccess, sendError } from '../../../shared/utils/response';
import { documentProcessingQueue } from '../../../shared/queues/queue-definitions';
import { logger } from '../../../shared/utils/logger';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const recordsController = {
  async uploadDocument(req: Request, res: Response) {
    try {
      if (!req.file) return sendError(res, 'No file uploaded', 400);
      const { patient_id, document_type, document_date } = req.body;

      const allowedMimes = (process.env.ALLOWED_MIME_TYPES || 'application/pdf,image/jpeg,image/png,image/heic').split(',');
      if (!allowedMimes.includes(req.file.mimetype)) {
        return sendError(res, 'File type not allowed', 400);
      }

      const year = new Date().getFullYear();
      const path = `${patient_id}/${year}/${document_type}/${Date.now()}_${req.file.originalname}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET_MEDICAL_DOCS || 'medical-documents')
        .upload(path, req.file.buffer, { contentType: req.file.mimetype });

      if (uploadError) { logger.error('Supabase upload error', uploadError); return sendError(res, 'File upload failed'); }

      const { data: urlData } = supabase.storage.from(process.env.SUPABASE_BUCKET_MEDICAL_DOCS || 'medical-documents').getPublicUrl(path);

      const doc = await recordsService.createDocument({
        patient_id, document_type, file_url: urlData.publicUrl, file_name: req.file.originalname,
        file_size_bytes: req.file.size, mime_type: req.file.mimetype, uploaded_by: req.user!.userId, document_date,
      });

      await documentProcessingQueue.add('processDocument', {
        documentId: doc.id, patientId: patient_id, fileUrl: urlData.publicUrl,
        documentType: document_type, mimeType: req.file.mimetype, retryCount: 0,
      });

      return sendSuccess(res, { document_id: doc.id, processing_status: 'queued' }, undefined, 201);
    } catch (err: any) { logger.error('Upload error', err); return sendError(res, err.message); }
  },

  async listDocuments(req: Request, res: Response) {
    try {
      const isSelf = req.user!.patientId === req.params.patient_id;
      const isDoctor = req.user!.role === 'doctor';
      if (!isSelf && !isDoctor) return sendError(res, 'Forbidden', 403);
      const docs = await recordsService.listDocuments(req.params.patient_id, req.query);
      return sendSuccess(res, docs);
    } catch (err: any) { return sendError(res, err.message); }
  },

  async getDocument(req: Request, res: Response) {
    try {
      const doc = await recordsService.getDocument(req.params.document_id);
      if (!doc) return sendError(res, 'Document not found', 404);

      const { data: urlData } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET_MEDICAL_DOCS || 'medical-documents')
        .createSignedUrl(doc.file_url.split('/').slice(-4).join('/'), 3600);

      return sendSuccess(res, { document: doc, signed_url: urlData?.signedUrl, extracted_text: doc.is_processed ? doc.extracted_text : undefined });
    } catch (err: any) { return sendError(res, err.message); }
  },

  async deleteDocument(req: Request, res: Response) {
    try {
      const doc = await recordsService.getDocument(req.params.document_id);
      if (!doc) return sendError(res, 'Not found', 404);
      const rag = new MedicalRAG();
      await rag.deleteDocumentVectors(doc.id);
      await recordsService.deleteDocument(doc.id);
      return sendSuccess(res, null, 'Document deleted');
    } catch (err: any) { return sendError(res, err.message); }
  },

  async ragChat(req: Request, res: Response) {
    try {
      const { patient_id, query, conversation_history, session_key } = req.body;
      const rag = new MedicalRAG();
      let result: any;
      try {
        result = await rag.query(query, patient_id, conversation_history || []);
      } catch (err: any) {
        if (err.message === 'qdrant_unavailable') return sendError(res, 'RAG chat temporarily unavailable', 503);
        if (err.message === 'ai_service_unavailable') return sendError(res, 'AI service temporarily unavailable. Please try again.', 503);
        throw err;
      }

      await recordsService.saveChatRecord({
        patient_id, queried_by: req.user!.userId, querier_role: req.user!.role as any, query,
        response: result.answer, source_document_ids: result.source_documents,
        confidence_score: result.confidence_score, session_key,
      });

      return sendSuccess(res, result);
    } catch (err: any) { logger.error('RAG chat error', err); return sendError(res, err.message); }
  },

  async getChatHistory(req: Request, res: Response) {
    try {
      const chats = await recordsService.getChatHistory(req.params.patient_id);
      return sendSuccess(res, { chats });
    } catch (err: any) { return sendError(res, err.message); }
  },

  async exportPdf(req: Request, res: Response) {
    try {
      await exportMedicalHistory(req.params.patient_id, res);
    } catch (err: any) { logger.error('PDF export error', err); return sendError(res, err.message); }
  },

  async reprocessDocument(req: Request, res: Response) {
    try {
      const doc = await recordsService.getDocument(req.params.document_id);
      if (!doc) return sendError(res, 'Not found', 404);
      await documentProcessingQueue.add('processDocument', {
        documentId: doc.id, patientId: doc.patient_id, fileUrl: doc.file_url,
        documentType: doc.document_type, mimeType: doc.mime_type, retryCount: 0,
      });
      return sendSuccess(res, { status: 'queued' });
    } catch (err: any) { return sendError(res, err.message); }
  },
};
