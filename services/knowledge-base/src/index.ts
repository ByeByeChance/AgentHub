import { createHealthServer } from '@agenthub/shared/server';
import { createInMemoryDB, DrizzleDB } from '@agenthub/shared/db';
import type { Database } from '@agenthub/shared/db';
import { KnowledgeService } from './knowledge-service.js';
import { MemoryService } from './memory-service.js';
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

const port = Number(process.env.KNOWLEDGE_BASE_PORT) || 3003;

function createEmbeddingStrategy(): EmbeddingStrategy {
  const strategy = process.env.EMBEDDING_STRATEGY ?? 'deepseek';
  switch (strategy) {
    case 'deepseek':
      return new DeepSeekEmbeddingStrategy();
    case 'mock':
      return new MockEmbeddingStrategy(1536);
    default:
      return new MockEmbeddingStrategy(1536);
  }
}

function createChunkingStrategy(): ChunkingStrategy {
  const strategy = process.env.CHUNKING_STRATEGY ?? 'recursive';
  switch (strategy) {
    case 'recursive':
      return new RecursiveChunker();
    case 'mock':
      return new MockChunker();
    default:
      return new RecursiveChunker();
  }
}

function createVectorStore(db: Database): VectorStoreBackend {
  const backend = process.env.VECTOR_BACKEND ?? 'pgvector';
  switch (backend) {
    case 'pgvector':
      return new PgVectorStore(db);
    case 'inmemory':
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

  // Register API routes
  registerKnowledgeRoutes(server, knowledgeService, memoryService);

  const shutdown = async (signal: string) => {
    server.log.info(`knowledge-base received ${signal}, shutting down...`);
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`knowledge-base listening on :${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

void main();
