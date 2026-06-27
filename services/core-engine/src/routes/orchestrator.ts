import type { FastifyInstance } from 'fastify';
import type { ConversationRouteDeps } from '../services/interfaces/conversation-routes.interface.js';
import type { ExecutionStrategy } from '@agenthub/shared/execution';
import { Orchestrator } from '../orchestrator/index.js';
import { toTransportReply } from './transport-reply.js';
import { createPinoLogger } from '@agenthub/shared/logging';
import { z } from 'zod';
import { registerApiRoute } from '@agenthub/shared/server';
import { ProblemDetail, ERROR_TYPES } from '@agenthub/shared/errors';

const executeGoalSchema = z.object({
  goal: z.string().min(1),
  agents: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      systemPrompt: z.string().optional(),
    }),
  ).min(1).optional(),
  mode: z.enum(['dag', 'sequential', 'parallel']).default('dag'),
});

/**
 * Register the orchestrator execution endpoint.
 *
 * POST /api/conversations/:id/execute
 * Body: { goal: string, agents?: AgentConfig[], mode?: 'dag' | 'sequential' | 'parallel' }
 *
 * Streams orchestrator lifecycle events (plan → task → aggregate) as SSE/NDJSON.
 */
export function registerOrchestratorRoute(
  app: FastifyInstance,
  deps: ConversationRouteDeps,
  executionStrategy: ExecutionStrategy,
): void {
  const {
    agentRegistry,
    agentRunner,
    toolExecutor,
    conversationService,
    workspaceService,
    eventBus,
    source,
    db,
    adapterFactory,
    transport,
    tokenRecorder,
    auditLogger,
  } = deps;

  const orchestrator = new Orchestrator();

  registerApiRoute(app, 'POST', '/conversations/:id/execute', async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };

    const bodyResult = executeGoalSchema.safeParse(request.body);
    if (!bodyResult.success) {
      throw ProblemDetail.fromZodError(bodyResult.error, request.url);
    }

    const { goal, agents: inputAgents } = bodyResult.data;

    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      throw new ProblemDetail({ type: ERROR_TYPES.NOT_FOUND, title: 'Not Found', status: 404, detail: 'Conversation not found', instance: request.url });
    }

    // Resolve agents: use provided agents or fetch from conversation
    let agents = inputAgents ?? [];
    if (agents.length === 0) {
      // Default: fetch all agents assigned to the conversation
      for (const aid of conversation.agentIds) {
        const a = await agentRegistry.getById(aid);
        if (a) {
          agents.push({
            id: a.id,
            name: a.name,
            systemPrompt: a.systemPrompt ?? undefined,
          });
        }
      }
    }

    if (agents.length === 0) {
      throw new ProblemDetail({ type: ERROR_TYPES.VALIDATION_ERROR, title: 'Bad Request', status: 400, detail: 'No agents available for execution', instance: request.url });
    }

    const controller = new AbortController();
    const signal = controller.signal;
    request.raw.on('close', () => controller.abort());
    const adapter = adapterFactory();

    // Override execution strategy if mode specified differs from default
    const strategy = executionStrategy;

    const logger = createPinoLogger(app.log, {
      service: 'core-engine',
      route: 'orchestrator',
    });

    const eventStream = orchestrator.execute({
      conversationId,
      goal,
      messages: [{ role: 'user', content: goal }],
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        systemPrompt: a.systemPrompt ?? '',
        adapterName: 'deepseek',
        modelId: process.env.DEEPSEEK_MODEL_ID ?? 'deepseek-v4-pro',
        toolNames: [],
      })),
      adapter,
      executionStrategy: strategy,
      agentRunner,
      toolExecutor,
      eventBus,
      source,
      conversationService,
      workspaceService,
      db,
      signal,
      logger,
      tokenRecorder,
      auditLogger,
    });

    await transport.streamEvents(eventStream, toTransportReply(reply), signal);
  });
}
