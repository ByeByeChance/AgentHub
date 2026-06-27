import type { FastifyInstance } from 'fastify';
import { EVENT_TYPES, createEventEnvelope } from '@agenthub/contracts';
import type { EventEnvelope } from '@agenthub/contracts';
import { createPinoLogger } from '@agenthub/shared/logging';
import { ProblemDetail, ERROR_TYPES } from '@agenthub/shared/errors';
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
      throw ProblemDetail.fromZodError(result.error, request.url);
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
      throw ProblemDetail.fromZodError(bodyResult.error, request.url);
    }

    const conversation = await conversationService.getConversation(
      conversationId,
    );
    if (!conversation) {
      throw new ProblemDetail({ type: ERROR_TYPES.NOT_FOUND, title: 'Not Found', status: 404, detail: 'Conversation not found', instance: request.url });
    }

    // Use caller-specified agentId, or fall back to the first assigned agent
    const agentId =
      bodyResult.data.agentId ?? conversation.agentIds[0];
    if (!agentId) {
      throw new ProblemDetail({ type: ERROR_TYPES.VALIDATION_ERROR, title: 'Bad Request', status: 400, detail: 'No agent assigned to conversation', instance: request.url });
    }

    // Validate that the requested agent belongs to this conversation
    if (!conversation.agentIds.includes(agentId)) {
      throw new ProblemDetail({ type: ERROR_TYPES.VALIDATION_ERROR, title: 'Bad Request', status: 400, detail: 'Agent is not assigned to this conversation', instance: request.url });
    }

    const agent = await agentRegistry.getById(agentId);
    if (!agent) {
      throw new ProblemDetail({ type: ERROR_TYPES.NOT_FOUND, title: 'Not Found', status: 404, detail: 'Agent not found', instance: request.url });
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

  // DELETE a message by ID
  app.delete('/api/conversations/:id/messages/:messageId', async (request, reply) => {
    const { messageId } = request.params as { id: string; messageId: string };
    try {
      await conversationService.deleteMessage(messageId);
      reply.code(204);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found')) {
        throw new ProblemDetail({ type: ERROR_TYPES.NOT_FOUND, title: 'Not Found', status: 404, detail: 'Message not found', instance: request.url });
      }
      throw new ProblemDetail({ type: ERROR_TYPES.INTERNAL_ERROR, title: 'Internal Server Error', status: 500, detail: msg, instance: request.url });
    }
  });
}
