import OpenAI from 'openai';
import type {
  AgentAdapter,
  StreamChunk,
  LLMMessage,
  ToolDefinition,
  AgentConfig,
} from '@agenthub/shared/adapter';
import { STREAM_CHUNK_TYPE } from '@agenthub/shared/adapter';

/**
 * OpenAIAdapter — uses the OpenAI API directly (not a compatible endpoint).
 *
 * Streams chat completions via the OpenAI SDK, mapping every delta into the
 * framework-agnostic StreamChunk discriminated union consumed by AgentRunner.
 *
 * Env vars: OPENAI_API_KEY, OPENAI_MODEL_ID (defaults to gpt-4.1)
 */
export class OpenAIAdapter implements AgentAdapter {
  readonly name = 'openai';
  private client: OpenAI;

  constructor(apiKey?: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.OPENAI_API_KEY ?? '',
      baseURL: baseURL ?? 'https://api.openai.com/v1',
    });
  }

  async *streamChat(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    signal: AbortSignal & { aborted: boolean },
  ): AsyncGenerator<StreamChunk> {
    if (signal.aborted) {
      throw new Error('Aborted');
    }

    const stream = await this.client.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL_ID ?? 'gpt-4.1',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages as any,
        tools:
          tools.length > 0
            ? tools.map((t) => ({
                type: 'function' as const,
                function: {
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters,
                },
              }))
            : undefined,
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal },
    );

    const toolCallsInProgress = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();

    for await (const chunk of stream) {
      if (signal.aborted) {
        throw new Error('Aborted');
      }

      const delta = chunk.choices?.[0]?.delta;
      const finishReason = chunk.choices?.[0]?.finish_reason;
      const usage = chunk.usage;

      // Text content
      if (delta?.content) {
        yield { type: STREAM_CHUNK_TYPE.TEXT_DELTA, content: delta.content };
      }

      // Tool calls
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const index = tc.index;

          if (!toolCallsInProgress.has(index)) {
            toolCallsInProgress.set(index, {
              id: tc.id ?? `call_${index}`,
              name: tc.function?.name ?? '',
              arguments: '',
            });

            yield {
              type: STREAM_CHUNK_TYPE.TOOL_USE_START,
              id: toolCallsInProgress.get(index)!.id,
              name: toolCallsInProgress.get(index)!.name,
            };
          }

          if (tc.function?.arguments) {
            const entry = toolCallsInProgress.get(index)!;
            entry.arguments += tc.function.arguments;
            yield {
              type: STREAM_CHUNK_TYPE.TOOL_USE_DELTA,
              id: entry.id,
              argumentDelta: tc.function.arguments,
            };
          }
        }
      }

      // Finish reason
      if (finishReason) {
        // Emit tool_use_end for completed tool calls
        for (const [, entry] of toolCallsInProgress) {
          let parsedInput: Record<string, unknown> = {};
          try {
            parsedInput = JSON.parse(entry.arguments);
          } catch (err) {
            console.warn(`[openai-adapter] Failed to parse tool call arguments for '${entry.name}': ${err instanceof Error ? err.message : String(err)}`);
            parsedInput = { raw: entry.arguments };
          }

          yield {
            type: STREAM_CHUNK_TYPE.TOOL_USE_END,
            id: entry.id,
            name: entry.name,
            input: parsedInput,
          };
        }

        if (usage) {
          yield {
            type: STREAM_CHUNK_TYPE.DONE,
            finishReason: finishReason as 'stop' | 'tool_calls' | 'length',
            usage: {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
            },
          };
        } else {
          yield {
            type: STREAM_CHUNK_TYPE.DONE,
            finishReason: finishReason as 'stop' | 'tool_calls' | 'length',
            usage: { promptTokens: 0, completionTokens: 0 },
          };
        }
      }
    }
  }

  buildSystemPrompt(config: AgentConfig): string {
    return `You are ${config.name}, an AI agent in the AgentHub multi-agent coordination platform.

${config.systemPrompt}

---
You have access to tools that can perform actions. Use them when needed.
Always think step by step before taking actions.
If you are unsure about something, ask for clarification.
Output your thinking in a structured way before giving final answers.

Current date: ${new Date().toISOString().split('T')[0]}`;
  }
}
