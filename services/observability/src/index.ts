import { createHealthServer } from '@agenthub/shared/server';
import { TokenRecorder } from './token-recorder.js';
import { AuditLogger } from './audit-logger.js';
import { DrizzleObservabilityDB, InMemoryObservabilityDB } from './db-implementation.js';
import type { ObservabilityDatabase } from './repository.js';
import { registerObservabilityRoutes } from './routes.js';

const port = Number(process.env.OBSERVABILITY_PORT) || 3004;

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

  // Register API routes
  registerObservabilityRoutes(server, tokenRecorder, auditLogger);

  const shutdown = async (signal: string) => {
    server.log.info(`observability received ${signal}, shutting down...`);
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`observability listening on :${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

void main();
