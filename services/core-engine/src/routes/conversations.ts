import type { FastifyInstance } from 'fastify';
import { EVENT_TYPES, createEventEnvelope } from '@agenthub/contracts';
import type { EventEnvelope } from '@agenthub/contracts';
import { createPinoLogger } from '@agenthub/shared/logging';
import type { ConversationRouteDeps } from '../services/interfaces/conversation-routes.interface.js';
import { createConvSchema, sendMessageSchema } from './validation/conversation-schemas.js';
import { toTransportReply } from './transport-reply.js';

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
    transport,
    tokenRecorder,
    auditLogger,
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

    const controller = new AbortController();
    const signal = controller.signal;
    request.raw.on('close', () => controller.abort());
    const adapter = adapterFactory();

    const logger = createPinoLogger(app.log, {
      service: 'core-engine',
      route: 'conversations',
    });

    const rawStream = agentRunner.run(
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
        tokenRecorder,
        auditLogger,
      },
      assistantMessage.id,
    );

    // Wrap to append the terminating message.complete event
    async function* streamWithComplete(): AsyncGenerator<EventEnvelope> {
      for await (const event of rawStream) {
        yield event;
      }
      yield createEventEnvelope(EVENT_TYPES.MESSAGE_COMPLETE, { conversationId }, source);
    }

    await transport.streamEvents(streamWithComplete(), toTransportReply(reply), signal);
  });
}
