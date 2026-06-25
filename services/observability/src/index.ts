import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
try { process.loadEnvFile?.(resolve(root, '.env')); } catch { /* optional */ }

import { createHealthServer } from '@agenthub/shared/server';
import { SERVICE_DEFAULTS } from '@agenthub/shared/constants';
import { createPinoLogger } from '@agenthub/shared/logging';
import { createQueueBackend } from '@agenthub/shared/queue';
import { TokenRecorder } from './token-recorder.js';
import { AuditLogger } from './audit-logger.js';
import { ObservabilityEventConsumer } from './event-consumer.js';
import { DrizzleObservabilityDB, InMemoryObservabilityDB } from './db-implementation.js';
import type { ObservabilityDatabase } from './repository.interface.js';
import { registerObservabilityRoutes } from './routes.js';

const port = Number(process.env.OBSERVABILITY_PORT) || SERVICE_DEFAULTS.ports.observability;

function createDB(): ObservabilityDatabase {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return new DrizzleObservabilityDB(databaseUrl);
  }
  return new InMemoryObservabilityDB();
}

async function main(): Promise<void> {
  const db = createDB();
  const tokenRecorder = new TokenRecorder(db);
  const auditLogger = new AuditLogger(db);
  const server = createHealthServer({ serviceName: 'observability', port });
  const logger = createPinoLogger(server.log, { service: 'observability' });

  // Register API routes
  registerObservabilityRoutes(server, tokenRecorder, auditLogger);

  // RabbitMQ consumer: subscribes to audit.* events from the EventBridge
  const queueBackend = createQueueBackend();
  if (queueBackend.name !== 'mock') {
    const consumer = new ObservabilityEventConsumer(queueBackend, auditLogger, logger);
    await consumer.start();
  }

  const shutdown = async (signal: string) => {
    logger.info(`observability received ${signal}, shutting down...`);
    await queueBackend.close().catch(() => {});
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await server.listen({ port, host: SERVICE_DEFAULTS.host });
    logger.info(`observability listening on :${port}`);
  } catch (err) {
    logger.error('observability failed to start', { error: String(err) });
    process.exit(1);
  }
}

void main();
