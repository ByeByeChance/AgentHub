import { createHealthServer } from '@agenthub/shared/server';
import { SkillRegistryOperations } from './operations.js';
import { DrizzleSkillDB, InMemorySkillDB } from './db-implementation.js';
import type { SkillDatabase } from './repository.js';
import { registerSkillRoutes } from './routes.js';
import { seedBuiltinSkills } from './seed.js';

const port = Number(process.env.SKILL_REGISTRY_PORT) || 3002;

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

  // Register API routes
  registerSkillRoutes(server, ops);

  // Seed built-in skills
  await seedBuiltinSkills(ops);

  const shutdown = async (signal: string) => {
    server.log.info(`skill-registry received ${signal}, shutting down...`);
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`skill-registry listening on :${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

void main();
