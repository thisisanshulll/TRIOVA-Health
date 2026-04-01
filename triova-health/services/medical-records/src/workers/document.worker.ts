import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../../../shared/queues/redis-client';
import { QUEUE_NAMES } from '../../../shared/queues/queue-definitions';
import { recordsService } from '../services/records.service';
import { MedicalRAG } from '../rag/MedicalRAG';
import { MedicationExtractorAgent } from '../agents/MedicationExtractorAgent';
import { logger } from '../../../shared/utils/logger';
import axios from 'axios';
import pdf from 'pdf-parse';
import Tesseract from 'tesseract.js';

export function startDocumentWorker() {
  const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  };

  const worker = new Worker(QUEUE_NAMES.DOCUMENT_PROCESSING, async (job: Job) => {
    const { documentId, patientId, fileUrl, documentType, mimeType, retryCount } = job.data;
    logger.info(`Processing document ${documentId} (Type: ${mimeType})`);

    try {
      // 1. Download file
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      let extractedText = '';

      // 2. Extract Text based on mime type
      if (mimeType === 'application/pdf') {
        const data = await pdf(buffer);
        extractedText = data.text;
      } else if (mimeType.startsWith('image/')) {
        const tesseractResult = await Tesseract.recognize(buffer, 'eng');
        extractedText = tesseractResult.data.text;
      } else {
        throw new Error(`Unsupported mime type for extraction: ${mimeType}`);
      }

      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error('No readable text extracted from document');
      }

      // 3. Vectorize text with RAG
      const rag = new MedicalRAG();
      const chunksIndexed = await rag.indexDocument(documentId, patientId, extractedText, {
        document_type: documentType,
        file_name: fileUrl.split('/').pop(),
        document_date: new Date().toISOString()
      });

      // 4. Update Database
      await recordsService.markProcessed(documentId, extractedText);
      logger.info(`Successfully processed document ${documentId}, indexed ${chunksIndexed} chunks`);

      // 5. Attempt Medication Extraction (non-blocking)
      if (['prescription', 'discharge_summary', 'consultation_note'].includes(documentType)) {
        const medAgent = new MedicationExtractorAgent();
        medAgent.extractAndSave(extractedText, patientId, undefined, documentId).catch(err => {
          logger.error(`Medication extraction failed for doc ${documentId}`, err);
        });
      }

    } catch (err: any) {
      logger.error(`Document processing failed for ${documentId}`, err);
      if (retryCount < 2) {
        throw err; // BullMQ will retry
      } else {
        await recordsService.markProcessingError(documentId, err.message, retryCount);
      }
    }
  }, { connection, concurrency: 2 });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed`, err);
  });

  logger.info('Document processing worker started');
  return worker;
}
