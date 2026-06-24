import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ConversationService } from '../services/conversation.service.js';
import type { AgentRegistry } from '../services/agent-registry.js';
import type { AgentRunner } from '../services/agent-runner.js';
import type { AgentAdapter } from '@agenthub/shared/adapter';
import type { ToolExecutor } from '../services/tool-executor.js';
import type { WorkspaceService } from '../services/workspace.service.js';
import type { EventBus } from '@agenthub/shared/event-bus';
import { EVENT_TYPES, type EventSource } from '@agenthub/contracts';
import type { Database } from '@agenthub/shared/db';
import { createPinoLogger } from '@agenthub/shared/logging';

const createConvSchema = z.object({
  title: z.string().optional(),
  mode: z.enum(['single', 'group']).optional(),
  agentIds: z.array(z.string()).min(1),
});

const sendMessageSchema = z.object({
  content: z.string().min(1),
  userMessageId: z.string().optional(),
  assistantMessageId: z.string().optional(),
});

export interface ConversationRouteDeps {
  conversationService: ConversationService;
  agentRegistry: AgentRegistry;
  agentRunner: AgentRunner;
  toolExecutor: ToolExecutor;
  workspaceService: WorkspaceService;
  eventBus: EventBus;
  source: EventSource;
  db: Database;
  adapterFactory: () => AgentAdapter;
}

export function registerConversationRoutes(
  app: FastifyInstance,
  deps: ConversationRouteDeps,
): void {
  const {
    conversationService,
    agentRegistry,
    agentRunner,
    toolExecutor,
    workspaceService,
    eventBus,
    source,
    db,
    adapterFactory,
  } = deps;

  app.post('/api/conversations', async (request, reply) => {
    const result = createConvSchema.safeParse(request.body);
    if (!result.success) {
      reply.code(400);
      return { error: 'Invalid request', details: result.error.issues };
    }
    const conv = await conversationService.createConversation(result.data);
    reply.code(201);
    return conv;
  });

  app.get('/api/conversations', async () => {
    return conversationService.listConversations();
  });

  app.get('/api/conversations/:id/messages', async (request) => {
    const { id } = request.params as { id: string };
    const { limit, offset } = request.query as {
      limit?: string;
      offset?: string;
    };
    return conversationService.getMessages(
      id,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  });

  app.post('/api/conversations/:id/messages', async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const bodyResult = sendMessageSchema.safeParse(request.body);
    if (!bodyResult.success) {
      reply.code(400);
      return { error: 'Invalid request', details: bodyResult.error.issues };
    }

    const conversation = await conversationService.getConversation(
      conversationId,
    );
    if (!conversation) {
      reply.code(404);
      return { error: 'Conversation not found' };
    }

    const agentId = conversation.agentIds[0];
    if (!agentId) {
      reply.code(400);
      return { error: 'No agent assigned to conversation' };
    }

    const agent = await agentRegistry.getById(agentId);
    if (!agent) {
      reply.code(404);
      return { error: 'Agent not found' };
    }

    // Create user message
    await conversationService.createMessage({
      conversationId,
      role: 'user',
      parts: [{ type: 'text', content: bodyResult.data.content }],
      id: bodyResult.data.userMessageId,
    });

    // Create assistant message (streaming)
    const assistantMessage = await conversationService.createMessage({
      conversationId,
      role: 'assistant',
      parts: [],
      id: bodyResult.data.assistantMessageId,
    });

    // Set up SSE response
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const controller = new AbortController();
    const signal = controller.signal;
    request.raw.on('close', () => controller.abort());
    const adapter = adapterFactory();

    const logger = createPinoLogger(app.log, {
      service: 'core-engine',
      route: 'conversations',
    });

    try {
      const stream = agentRunner.run(
        {
          agentConfig: {
            id: agent.id,
            name: agent.name,
            systemPrompt: agent.systemPrompt,
            adapterName: agent.adapterName,
            modelId: agent.modelId,
            toolNames: agent.toolNames,
          },
          conversationId,
          messages: [
            { role: 'user', content: bodyResult.data.content },
          ],
          toolExecutor,
          adapter,
          eventBus,
          source,
          conversationService,
          workspaceService,
          db,
          signal,
          logger,
        },
        assistantMessage.id,
      );

      for await (const event of stream) {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      reply.raw.write(
        `data: ${JSON.stringify({ eventType: EVENT_TYPES.MESSAGE_COMPLETE, conversationId })}\n\n`,
      );
    } catch (err) {
      reply.raw.write(
        `data: ${JSON.stringify({ eventType: EVENT_TYPES.AGENT_RUN_FAILED, payload: { error: String(err) } })}\n\n`,
      );
    } finally {
      reply.raw.end();
    }
  });
}
