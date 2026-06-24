import { createHealthServer } from '@agenthub/shared/server';
import { getEventBus } from '@agenthub/shared/event-bus';
import { InMemoryDB, DrizzleDB, type Database } from '@agenthub/shared/db';
import { SERVICE_DEFAULTS } from '@agenthub/shared/constants';
import { createPinoLogger } from '@agenthub/shared/logging';
import { DeepSeekAdapter } from './adapters/deepseek-adapter.js';
import { AgentRegistry } from './services/agent-registry.js';
import { ConversationService } from './services/conversation.service.js';
import { ToolExecutor } from './services/tool-executor.js';
import { AgentRunner } from './services/agent-runner.js';
import { createWorkspaceService } from './services/workspace.service.js';
import { registerAgentRoutes, registerConversationRoutes, registerEventRoutes } from './routes/index.js';
import type { AgentAdapter } from '@agenthub/shared/adapter';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

const port = Number(process.env.CORE_ENGINE_PORT) || SERVICE_DEFAULTS.ports.coreEngine;

async function main(): Promise<void> {
  const app = createHealthServer({ serviceName: 'core-engine', port });
  const logger = createPinoLogger(app.log, { service: 'core-engine' });

  // Initialize database
  const dbUrl = process.env.DATABASE_URL;
  const db: Database = dbUrl
    ? new DrizzleDB(dbUrl)
    : new InMemoryDB();
  if (dbUrl) {
    logger.info('Using PostgreSQL database');
  } else {
    logger.warn('DATABASE_URL not set, using in-memory database (data will not persist!)');
  }
  const eventBus = getEventBus();
  const source = {
    service: 'core-engine' as const,
    instanceId: `core-engine-${process.pid ?? '1'}`,
  };

  // Initialize services
  const agentRegistry = new AgentRegistry(db);
  const conversationService = new ConversationService(db);
  const toolExecutor = new ToolExecutor();

  const workspaceRoot = process.env.WORKSPACE_ROOT ?? join(process.cwd(), '.agenthub-data', 'workspaces');
  await mkdir(workspaceRoot, { recursive: true });
  const workspaceService = createWorkspaceService(workspaceRoot);

  const agentRunner = new AgentRunner();

  // TODO: Wire TokenRecorder and AuditLogger from observability service.
  // When the observability service integration is prioritized, create
  // TokenRecorder and AuditLogger instances here and pass them via
  // ConversationRouteDeps so they flow into AgentRunInput.

  const adapterFactory = (): AgentAdapter => {
    const adapterName = process.env.AGENT_ADAPTER ?? 'deepseek';
    if (adapterName === 'deepseek') return new DeepSeekAdapter();
    return new DeepSeekAdapter();
  };

  // Register API routes
  registerAgentRoutes(app, agentRegistry);
  registerConversationRoutes(app, { conversationService, agentRegistry, agentRunner, toolExecutor, workspaceService, eventBus, source, db, adapterFactory });
  registerEventRoutes(app, eventBus);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`core-engine received ${signal}, shutting down...`);
    if (db instanceof DrizzleDB) await db.close();
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port, host: SERVICE_DEFAULTS.host });
    logger.info(`core-engine listening on :${port}`);
  } catch (err) {
    logger.error('core-engine failed to start', { error: String(err) });
    process.exit(1);
  }
}

void main();
