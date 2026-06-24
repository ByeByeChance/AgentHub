import type { FastifyInstance } from 'fastify';
import type { KnowledgeService } from './knowledge-service.js';
import type { MemoryService } from './memory-service.js';
import { addDocumentSchema, searchQuerySchema } from './knowledge-service.js';
import { shortTermSchema, workingMemorySchema } from './memory-service.js';
import { z } from 'zod';

export function registerKnowledgeRoutes(
  app: FastifyInstance,
  knowledgeService: KnowledgeService,
  memoryService: MemoryService,
): void {
  // POST /api/knowledge/documents — add document
  app.post('/api/knowledge/documents', async (request, reply) => {
    try {
      const input = addDocumentSchema.parse(request.body);
      const result = await knowledgeService.addDocument(input);
      return reply.status(201).send(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: err.errors });
      }
      throw err;
    }
  });

  // POST /api/knowledge/search — search documents
  app.post('/api/knowledge/search', async (request, reply) => {
    try {
      const input = searchQuerySchema.parse(request.body);
      const results = await knowledgeService.search(input);
      return reply.send(results);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: err.errors });
      }
      throw err;
    }
  });

  // DELETE /api/knowledge/documents/:id — delete document
  app.delete('/api/knowledge/documents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await knowledgeService.deleteDocument(id);
    return reply.status(204).send();
  });

  // ===== Working Memory =====

  // POST /api/knowledge/memory/working — set working memory
  app.post('/api/knowledge/memory/working', async (request, reply) => {
    try {
      const input = workingMemorySchema.parse(request.body);
      memoryService.setWorkingMemory(
        input.conversationId,
        input.entries as { key: string; value: unknown; ttl?: number }[],
      );
      return reply.status(200).send({ ok: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: err.errors });
      }
      throw err;
    }
  });

  // GET /api/knowledge/memory/working/:convId — get working memory
  app.get('/api/knowledge/memory/working/:convId', async (request, reply) => {
    const { convId } = request.params as { convId: string };
    const entries = memoryService.getWorkingMemory(convId);
    return reply.send(entries);
  });

  // DELETE /api/knowledge/memory/working/:convId — clear working memory
  app.delete('/api/knowledge/memory/working/:convId', async (request, reply) => {
    const { convId } = request.params as { convId: string };
    memoryService.clearWorkingMemory(convId);
    return reply.status(204).send();
  });

  // ===== Short-term Memory =====

  // POST /api/knowledge/memory/short-term — store short-term memory
  app.post('/api/knowledge/memory/short-term', async (request, reply) => {
    try {
      const input = shortTermSchema.parse(request.body);
      await memoryService.storeShortTermMemory(input);
      return reply.status(201).send({ ok: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: err.errors });
      }
      throw err;
    }
  });

  // GET /api/knowledge/memory/short-term/:convId — recall short-term memory
  app.get('/api/knowledge/memory/short-term/:convId', async (request, reply) => {
    const { convId } = request.params as { convId: string };
    const results = await memoryService.recallShortTermMemory(convId);
    return reply.send(results);
  });

  // ===== Long-term Memory =====

  // POST /api/knowledge/memory/long-term — store long-term memory
  app.post('/api/knowledge/memory/long-term', async (request, reply) => {
    try {
      const { content, metadata, conversationId } = request.body as {
        content?: string;
        metadata?: Record<string, unknown>;
        conversationId?: string;
      };
      if (!content || typeof content !== 'string') {
        return reply.status(400).send({ error: 'content is required' });
      }
      const result = await memoryService.storeLongTermMemory({
        content,
        metadata,
        conversationId,
      });
      return reply.status(201).send(result);
    } catch (err) {
      throw err;
    }
  });

  // POST /api/knowledge/memory/long-term/recall — recall long-term memory
  app.post('/api/knowledge/memory/long-term/recall', async (request, reply) => {
    const { query, topK, threshold } = (request.body ?? {}) as {
      query?: string;
      topK?: number;
      threshold?: number;
    };
    if (!query || typeof query !== 'string') {
      return reply.status(400).send({ error: 'query is required' });
    }
    const results = await memoryService.recallLongTermMemory(query, topK, threshold);
    return reply.send(results);
  });
}
