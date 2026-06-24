import type {
  AgentAdapter,
  AgentConfig,
  LLMMessage,
} from '@agenthub/shared/adapter';
import type { EventBus } from '@agenthub/shared/event-bus';
import { createEventEnvelope, EVENT_TYPES } from '@agenthub/contracts';
import type { EventEnvelope, EventSource } from '@agenthub/contracts';
import type { ToolExecutor, ToolContext } from './tool-executor.js';
import type { ConversationService } from './conversation.service.js';
import type { WorkspaceService } from './workspace.service.js';
import type { Database } from '@agenthub/shared/db';

export interface AgentRunInput {
  agentConfig: AgentConfig;
  conversationId: string;
  messages: LLMMessage[];
  toolExecutor: ToolExecutor;
  adapter: AgentAdapter;
  eventBus: EventBus;
  source: EventSource;
  conversationService: ConversationService;
  workspaceService: WorkspaceService;
  db: Database;
  signal: AbortSignal & { aborted: boolean };
  maxToolRounds?: number;
}

export class AgentRunner {
  async *run(
    input: AgentRunInput,
    messageId: string,
  ): AsyncGenerator<EventEnvelope> {
    const {
      agentConfig,
      conversationId,
      messages,
      toolExecutor,
      adapter,
      eventBus,
      source,
      conversationService,
      workspaceService,
      db,
      signal,
      maxToolRounds = 10,
    } = input;

    const makeEnvelope = (eventType: string, payload: unknown) =>
      createEventEnvelope(eventType, payload, source);

    try {
      // 1. AGENT_RUN_START
      const startEvent = makeEnvelope(EVENT_TYPES.AGENT_RUN_START, {
        agentId: agentConfig.id,
        agentName: agentConfig.name,
        conversationId,
        messageId,
      });
      eventBus.emit(startEvent);
      yield startEvent;

      // 2. Build initial messages
      const systemPrompt = adapter.buildSystemPrompt(agentConfig);
      const llmMessages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages,
      ];

      // 3. Get tool definitions
      const toolDefs = toolExecutor.getDefinitions();

      // 4. Tool loop
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;

      for (let round = 0; round < maxToolRounds; round++) {
        if (signal.aborted) {
          throw new Error('Aborted');
        }

        const toolCalls: Array<{
          id: string;
          name: string;
          input: Record<string, unknown>;
        }> = [];

        // 4a. Stream from adapter
        for await (const chunk of adapter.streamChat(
          llmMessages,
          toolDefs,
          signal,
        )) {
          // Yield stream chunks as MESSAGE_PART events
          switch (chunk.type) {
            case 'text_delta': {
              const event = makeEnvelope(EVENT_TYPES.MESSAGE_PART_TEXT, {
                messageId,
                content: chunk.content,
              });
              eventBus.emit(event);
              yield event;
              // Append to DB
              await conversationService.appendPart(messageId, {
                type: 'text',
                content: chunk.content,
              });
              break;
            }
            case 'thinking_delta': {
              const event = makeEnvelope(EVENT_TYPES.MESSAGE_PART_THINKING, {
                messageId,
                content: chunk.content,
              });
              eventBus.emit(event);
              yield event;
              await conversationService.appendPart(messageId, {
                type: 'thinking',
                content: chunk.content,
              });
              break;
            }
            case 'tool_use_start': {
              const event = makeEnvelope(EVENT_TYPES.MESSAGE_PART_TOOL_USE, {
                messageId,
                toolCallId: chunk.id,
                toolName: chunk.name,
                phase: 'start',
              });
              eventBus.emit(event);
              yield event;
              break;
            }
            case 'tool_use_end': {
              toolCalls.push({
                id: chunk.id,
                name: chunk.name,
                input: chunk.input,
              });
              break;
            }
            case 'done': {
              totalPromptTokens += chunk.usage.promptTokens;
              totalCompletionTokens += chunk.usage.completionTokens;
              break;
            }
          }
        }

        // 4b. If no tool calls, we're done
        if (toolCalls.length === 0) break;

        // 4c. Execute tool calls
        const toolContext: ToolContext = {
          conversationId,
          workspaceService,
          db,
          agentId: agentConfig.id,
          signal,
        };

        // Add assistant message with tool calls
        llmMessages.push({
          role: 'assistant',
          content: '',
        });

        for (const tc of toolCalls) {
          const result = await toolExecutor.execute(
            tc.name,
            tc.input,
            toolContext,
          );

          // Yield tool result
          const event = makeEnvelope(EVENT_TYPES.MESSAGE_PART_TOOL_RESULT, {
            messageId,
            toolCallId: tc.id,
            toolName: tc.name,
            result: result.result,
            isError: result.isError,
          });
          eventBus.emit(event);
          yield event;

          // Append to DB
          await conversationService.appendPart(messageId, {
            type: 'tool_result',
            toolCallId: tc.id,
            toolName: tc.name,
            toolResult: result.result,
            isError: result.isError,
          });

          // Add tool result to LLM messages
          llmMessages.push({
            role: 'tool',
            content: String(result.result),
            toolCallId: tc.id,
            name: tc.name,
          });
        }
      }

      // 5. Update message status
      await conversationService.updateStatus(messageId, 'complete');

      // 6. AGENT_RUN_COMPLETE
      const completeEvent = makeEnvelope(EVENT_TYPES.AGENT_RUN_COMPLETE, {
        agentId: agentConfig.id,
        conversationId,
        messageId,
        usage: {
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
        },
      });
      eventBus.emit(completeEvent);
      yield completeEvent;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isAborted = errorMessage === 'Aborted';

      if (isAborted) {
        const abortEvent = makeEnvelope(EVENT_TYPES.AGENT_RUN_ABORTED, {
          agentId: agentConfig.id,
          conversationId,
          messageId,
        });
        eventBus.emit(abortEvent);
        yield abortEvent;
        await conversationService.updateStatus(messageId, 'aborted');
      } else {
        const failEvent = makeEnvelope(EVENT_TYPES.AGENT_RUN_FAILED, {
          agentId: agentConfig.id,
          conversationId,
          messageId,
          error: errorMessage,
        });
        eventBus.emit(failEvent);
        yield failEvent;
        await conversationService.updateStatus(messageId, 'failed');
      }
    }
  }
}
