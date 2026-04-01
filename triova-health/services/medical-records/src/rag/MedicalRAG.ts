import OpenAI from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { pool } from '../../../shared/db/pool';
import { logger } from '../../../shared/utils/logger';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL || 'http://localhost:6333' });
const COLLECTION = 'medical_documents';
const CHUNK_SIZE = 1000;
const OVERLAP = 200;

export class MedicalRAG {
  chunkText(text: string): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let current = '';
    for (const sentence of sentences) {
      if ((current + sentence).length > CHUNK_SIZE) {
        if (current) chunks.push(current.trim());
        current = chunks.length > 0 ? (chunks[chunks.length - 1].slice(-OVERLAP) + ' ' + sentence) : sentence;
      } else {
        current += (current ? ' ' : '') + sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.filter((c) => c.length > 50);
  }

  async embedText(text: string): Promise<number[]> {
    let retries = 3;
    while (retries > 0) {
      try {
        const response = await openai.embeddings.create({
          model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
          input: text,
        });
        return response.data[0].embedding;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    return [];
  }

  async indexDocument(documentId: string, patientId: string, text: string, metadata: Record<string, any>) {
    const chunks = this.chunkText(text);
    const points = [];

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this.embedText(chunks[i]);
      points.push({
        id: `${documentId}_${i}`,
        vector: embedding,
        payload: {
          patient_id: patientId,
          document_id: documentId,
          document_type: metadata.document_type,
          chunk_text: chunks[i],
          chunk_index: i,
          document_date: metadata.document_date,
          file_name: metadata.file_name,
          metadata,
        },
      });
    }

    if (points.length > 0) {
      await qdrant.upsert(COLLECTION, { points });
    }
    return points.length;
  }

  async query(query: string, patientId: string, conversationHistory: Array<{ role: string; content: string }> = []) {
    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.embedText(query);
    } catch (err) {
      throw new Error('ai_service_unavailable');
    }

    let searchResults: any[] = [];
    try {
      const results = await qdrant.search(COLLECTION, {
        vector: queryEmbedding,
        limit: 5,
        filter: { must: [{ key: 'patient_id', match: { value: patientId } }] },
        with_payload: true,
      });
      searchResults = results;
    } catch (err: any) {
      if (err.message?.includes('connect')) throw new Error('qdrant_unavailable');
      throw err;
    }

    if (!searchResults.length || searchResults[0].score < 0.4) {
      return {
        answer: 'This information is not available in the uploaded medical records. Please ensure the relevant document has been uploaded, or consult with your doctor.',
        source_documents: [],
        confidence_score: 0,
        is_from_records: false,
      };
    }

    const topScore = searchResults[0].score;
    const confidence = Math.round(topScore * 100);
    const context = searchResults.map((r: any) => r.payload.chunk_text).join('\n\n---\n\n');
    const sourceDocIds = [...new Set(searchResults.map((r: any) => r.payload.document_id))];

    const systemPrompt = `You are TRIOVA's medical records assistant. Your ONLY job is to answer questions based on the uploaded medical records provided below.

STRICT RULES:
1. Answer ONLY from the context provided. Never use general medical knowledge to fill gaps.
2. If the information is not in the records, respond with: "This information is not available in the uploaded medical records. Please ensure the relevant document has been uploaded, or consult with your doctor."
3. If you find partial information, share it and clearly note what is missing.
4. Quote specific values exactly as they appear (e.g., medication doses, test results).
5. Do NOT provide medical advice, diagnoses, or treatment suggestions.
6. When citing, mention the document type (e.g., "According to the lab report from [date]...").

Medical Records Context:
${context}`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: 'user', content: query },
    ];

    let answerText: string;
    try {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages,
        max_tokens: 1000,
      });
      answerText = completion.choices[0].message.content || '';
    } catch (err) {
      throw new Error('ai_service_unavailable');
    }

    if (topScore < 0.6) {
      answerText = '⚠️ The following is based on limited matching information and may not be fully accurate. Please verify with your doctor.\n\n' + answerText;
    }

    return {
      answer: answerText,
      source_documents: sourceDocIds,
      confidence_score: confidence,
      is_from_records: true,
    };
  }

  async deleteDocumentVectors(documentId: string) {
    try {
      await qdrant.delete(COLLECTION, {
        filter: { must: [{ key: 'document_id', match: { value: documentId } }] },
      });
    } catch (err) {
      logger.error('Failed to delete vectors for document', { documentId, err });
    }
  }
}
