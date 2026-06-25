import { createHealthServer } from '@agenthub/shared/server';
import { getEventBus, EventBridge } from '@agenthub/shared/event-bus';
import { InMemoryDB, DrizzleDB, type Database } from '@agenthub/shared/db';
import { SERVICE_DEFAULTS } from '@agenthub/shared/constants';
import { createPinoLogger } from '@agenthub/shared/logging';
import { createAuthStrategy } from '@agenthub/shared/auth';
import { createQueueBackend } from '@agenthub/shared/queue';
import { createTransport } from './transport/index.js';
import { createExecutionStrategy } from './execution/index.js';
import { createObservabilityClients } from './observability/index.js';
import { DeepSeekAdapter } from './adapters/deepseek-adapter.js';
import { AgentRegistry } from './services/agent-registry.js';
import { ConversationService } from './services/conversation.service.js';
import { ToolExecutor } from './services/tool-executor.js';
import { AgentRunner } from './services/agent-runner.js';
import { createWorkspaceService } from './services/workspace.service.js';
import { registerAgentRoutes, registerConversationRoutes, registerEventRoutes } from './routes/index.js';
import { registerOrchestratorRoute } from './routes/orchestrator.js';
import { registerAuthMiddleware } from './auth/middleware.js';
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

  // Observability clients — BestEffort (log-only) by default, HTTP-client when
  // OBSERVABILITY_CLIENT=http and OBSERVABILITY_URL is set.
  const { tokenRecorder, auditLogger } = createObservabilityClients(logger);

  const adapterFactory = (): AgentAdapter => {
    const adapterName = process.env.AGENT_ADAPTER ?? 'deepseek';
    if (adapterName === 'deepseek') return new DeepSeekAdapter();
    logger.warn(`Unknown AGENT_ADAPTER "${adapterName}" — falling back to DeepSeekAdapter`);
    return new DeepSeekAdapter();
  };

  // Pluggable strategies — controlled by environment variables
  const transport = createTransport();
  const executionStrategy = createExecutionStrategy();
  const queueBackend = createQueueBackend();

  logger.info('Active strategies', {
    transport: transport.name,
    execution: executionStrategy.name,
    queue: queueBackend.name,
    auth: process.env.AUTH_STRATEGY ?? 'noop',
    adapter: process.env.AGENT_ADAPTER ?? 'deepseek',
  });

  // Register auth middleware (AUTH_STRATEGY env var controls which strategy)
  const authStrategy = createAuthStrategy();
  registerAuthMiddleware(app, authStrategy);

  // Register API routes
  registerAgentRoutes(app, agentRegistry);
  registerConversationRoutes(app, { conversationService, agentRegistry, agentRunner, toolExecutor, workspaceService, eventBus, source, db, adapterFactory, transport, tokenRecorder, auditLogger });
  registerOrchestratorRoute(app, { conversationService, agentRegistry, agentRunner, toolExecutor, workspaceService, eventBus, source, db, adapterFactory, transport, tokenRecorder, auditLogger }, executionStrategy);
  registerEventRoutes(app, eventBus, transport);

  // EventBridge: bridges in-memory EventBus → RabbitMQ for cross-service events.
  // Only activated when a real queue backend (not mock) is configured.
  let eventBridge: EventBridge | null = null;
  if (queueBackend.name !== 'mock') {
    eventBridge = new EventBridge(eventBus, queueBackend);
    await eventBridge.start();
    logger.info('EventBridge started (EventBus → QueueBackend)');
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`core-engine received ${signal}, shutting down...`);
    if (eventBridge) await eventBridge.stop().catch(() => {});
    await queueBackend.close().catch(() => {});
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
