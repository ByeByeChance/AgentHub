import OpenAI from 'openai';
import type {
  AgentAdapter,
  StreamChunk,
  LLMMessage,
  ToolDefinition,
  AgentConfig,
} from '@agenthub/shared/adapter';

export class DeepSeekAdapter implements AgentAdapter {
  readonly name = 'deepseek';
  private client: OpenAI;

  constructor(apiKey?: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.DEEPSEEK_API_KEY ?? '',
      baseURL: baseURL ?? 'https://api.deepseek.com/v1',
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
        model: process.env.DEEPSEEK_MODEL_ID ?? 'deepseek-v4-pro',
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
        yield { type: 'text_delta', content: delta.content };
      }

      // Reasoning/thinking content (DeepSeek R1 models)
      if ((delta as Record<string, unknown>)?.['reasoning_content']) {
        yield {
          type: 'thinking_delta',
          content: (delta as Record<string, string>)['reasoning_content'] ?? '',
        };
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
              type: 'tool_use_start',
              id: toolCallsInProgress.get(index)!.id,
              name: toolCallsInProgress.get(index)!.name,
            };
          }

          if (tc.function?.arguments) {
            const entry = toolCallsInProgress.get(index)!;
            entry.arguments += tc.function.arguments;
            yield {
              type: 'tool_use_delta',
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
          } catch {
            parsedInput = { raw: entry.arguments };
          }

          yield {
            type: 'tool_use_end',
            id: entry.id,
            name: entry.name,
            input: parsedInput,
          };
        }

        if (usage) {
          yield {
            type: 'done',
            finishReason: finishReason as 'stop' | 'tool_calls' | 'length',
            usage: {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
            },
          };
        } else {
          yield {
            type: 'done',
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
