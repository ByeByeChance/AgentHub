import { createHealthServer } from '@agenthub/shared/server';
import { SERVICE_DEFAULTS } from '@agenthub/shared/constants';
import { createPinoLogger } from '@agenthub/shared/logging';
import { SkillRegistryOperations } from './operations.js';
import { DrizzleSkillDB, InMemorySkillDB } from './db-implementation.js';
import type { SkillDatabase } from './repository.interface.js';
import { registerSkillRoutes } from './routes.js';
import { seedBuiltinSkills } from './seed.js';

const port = Number(process.env.SKILL_REGISTRY_PORT) || SERVICE_DEFAULTS.ports.skillRegistry;

function createDB(): SkillDatabase {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return new DrizzleSkillDB(databaseUrl);
  }
  return new InMemorySkillDB();
}

async function main(): Promise<void> {
  const db = createDB();
  const ops = new SkillRegistryOperations(db);
  const server = createHealthServer({ serviceName: 'skill-registry', port });
  const logger = createPinoLogger(server.log, { service: 'skill-registry' });

  // Register API routes
  registerSkillRoutes(server, ops);

  // Seed built-in skills
  await seedBuiltinSkills(ops);

  const shutdown = async (signal: string) => {
    logger.info(`skill-registry received ${signal}, shutting down...`);
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await server.listen({ port, host: SERVICE_DEFAULTS.host });
    logger.info(`skill-registry listening on :${port}`);
  } catch (err) {
    logger.error('skill-registry failed to start', { error: String(err) });
    process.exit(1);
  }
}

void main();
