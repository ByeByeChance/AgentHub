import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
try { process.loadEnvFile?.(resolve(root, '.env')); } catch { /* optional */ }

import { createHealthServer } from '@agenthub/shared/server';
import { SERVICE_DEFAULTS, STRATEGY_NAMES } from '@agenthub/shared/constants';
import { createPinoLogger } from '@agenthub/shared/logging';
import { createInMemoryDB, DrizzleDB } from '@agenthub/shared/db';
import { createQueueBackend } from '@agenthub/shared/queue';
import type { Database } from '@agenthub/shared/db';
import { KnowledgeService } from './knowledge-service.js';
import { MemoryService } from './memory-service.js';
import { KnowledgeEventConsumer } from './event-consumer.js';
import {
  DeepSeekEmbeddingStrategy,
  RecursiveChunker,
  PgVectorStore,
  MockEmbeddingStrategy,
  MockChunker,
  InMemoryVectorStore,
} from './strategies/index.js';
import type { EmbeddingStrategy, ChunkingStrategy, VectorStoreBackend } from './strategies/index.js';
import { registerKnowledgeRoutes } from './routes.js';
import type { FastifyInstance } from 'fastify';

const port = Number(process.env.KNOWLEDGE_BASE_PORT) || SERVICE_DEFAULTS.ports.knowledgeBase;

function createEmbeddingStrategy(): EmbeddingStrategy {
  const strategy = process.env.EMBEDDING_STRATEGY ?? STRATEGY_NAMES.EMBEDDING[0];
  switch (strategy) {
    case STRATEGY_NAMES.EMBEDDING[0]:
      if (!process.env.DEEPSEEK_API_KEY) {
        // Gracefully fall back to mock when API key is not configured
        return new MockEmbeddingStrategy(SERVICE_DEFAULTS.embedding.dimension);
      }
      return new DeepSeekEmbeddingStrategy();
    case STRATEGY_NAMES.EMBEDDING[1]:
      return new MockEmbeddingStrategy(SERVICE_DEFAULTS.embedding.dimension);
    default:
      return new MockEmbeddingStrategy(SERVICE_DEFAULTS.embedding.dimension);
  }
}

function createChunkingStrategy(): ChunkingStrategy {
  const strategy = process.env.CHUNKING_STRATEGY ?? STRATEGY_NAMES.CHUNKING[0];
  switch (strategy) {
    case STRATEGY_NAMES.CHUNKING[0]:
      return new RecursiveChunker();
    case STRATEGY_NAMES.CHUNKING[1]:
      return new MockChunker();
    default:
      return new RecursiveChunker();
  }
}

function createVectorStore(db: Database): VectorStoreBackend {
  const backend = process.env.VECTOR_BACKEND ?? STRATEGY_NAMES.VECTOR_BACKENDS[0];
  switch (backend) {
    case STRATEGY_NAMES.VECTOR_BACKENDS[0]:
      return new PgVectorStore(db);
    case STRATEGY_NAMES.VECTOR_BACKENDS[1]:
      return new InMemoryVectorStore();
    default:
      return new InMemoryVectorStore();
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const db: Database = databaseUrl ? new DrizzleDB(databaseUrl) : createInMemoryDB();

  const embeddingStrategy = createEmbeddingStrategy();
  const chunkingStrategy = createChunkingStrategy();
  const vectorStore = createVectorStore(db);

  const knowledgeService = new KnowledgeService(
    embeddingStrategy,
    chunkingStrategy,
    vectorStore,
  );
  const memoryService = new MemoryService(knowledgeService);

  const server: FastifyInstance = createHealthServer({
    serviceName: 'knowledge-base',
    port,
  });
  const logger = createPinoLogger(server.log, { service: 'knowledge-base' });

  // Register API routes
  registerKnowledgeRoutes(server, knowledgeService, memoryService);

  // RabbitMQ consumer: subscribes to knowledge.* events from the EventBridge
  const queueBackend = createQueueBackend();
  if (queueBackend.name !== 'mock') {
    const consumer = new KnowledgeEventConsumer(queueBackend, knowledgeService, logger);
    await consumer.start();
  }

  const shutdown = async (signal: string) => {
    logger.info(`knowledge-base received ${signal}, shutting down...`);
    await queueBackend.close().catch(() => {});
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await server.listen({ port, host: SERVICE_DEFAULTS.host });
    logger.info(`knowledge-base listening on :${port}`);
  } catch (err) {
    logger.error('knowledge-base failed to start', { error: String(err) });
    process.exit(1);
  }
}

void main();
