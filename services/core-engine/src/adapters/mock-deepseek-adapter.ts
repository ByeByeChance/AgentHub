import type {
  AgentAdapter,
  StreamChunk,
  LLMMessage,
  ToolDefinition,
  AgentConfig,
} from '@agenthub/shared/adapter';

export class MockDeepSeekAdapter implements AgentAdapter {
  readonly name = 'mock-deepseek';
  private responseQueue: StreamChunk[][] = [];
  private currentIndex = 0;

  setResponses(chunks: StreamChunk[][]): void {
    this.responseQueue = chunks;
    this.currentIndex = 0;
  }

  setTextResponse(text: string): void {
    this.setResponses([
      [
        { type: 'text_delta', content: text },
        {
          type: 'done',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 5 },
        },
      ],
    ]);
  }

  setToolCallSequence(
    toolCalls: Array<{ name: string; input: Record<string, unknown> }>,
    finalText?: string,
  ): void {
    const responses: StreamChunk[][] = [];

    for (const tc of toolCalls) {
      responses.push([
        {
          type: 'tool_use_start',
          id: `call_${tc.name}_${responses.length}`,
          name: tc.name,
        },
        {
          type: 'tool_use_end',
          id: `call_${tc.name}_${responses.length}`,
          name: tc.name,
          input: tc.input,
        },
        {
          type: 'done',
          finishReason: 'tool_calls',
          usage: { promptTokens: 20, completionTokens: 10 },
        },
      ]);
    }

    // Final text response after tool calls
    if (finalText !== undefined) {
      responses.push([
        { type: 'text_delta', content: finalText },
        {
          type: 'done',
          finishReason: 'stop',
          usage: { promptTokens: 30, completionTokens: 15 },
        },
      ]);
    }

    this.setResponses(responses);
  }

  /**
   * Push a sequence of text responses. Each call to streamChat() consumes
   * the next element from the queue. Useful for multi-round tests (e.g.
   * CrossReview with multiple reviewer calls + auto-fix).
   *
   * @param texts  Array of text strings — one per streamChat call
   */
  setTextSequence(texts: string[]): void {
    this.responseQueue = texts.map((text) => [
      { type: 'text_delta', content: text } as StreamChunk,
      {
        type: 'done',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as StreamChunk,
    ]);
    this.currentIndex = 0;
  }

  setError(errorMessage: string): void {
    this.responseQueue = [];
    // Throw on next call
    const originalStreamChat = this.streamChat.bind(this);
    this.streamChat = async function* () {
      throw new Error(errorMessage);
    };
    // Restore after use
    setTimeout(() => {
      this.streamChat = originalStreamChat;
    }, 0);
  }

  async *streamChat(
    _messages: LLMMessage[],
    _tools: ToolDefinition[],
    signal: AbortSignal & { aborted: boolean },
  ): AsyncGenerator<StreamChunk> {
    if (this.currentIndex >= this.responseQueue.length) {
      // Default: simple text response
      yield { type: 'text_delta', content: 'Mock response' };
      yield {
        type: 'done',
        finishReason: 'stop',
        usage: { promptTokens: 5, completionTokens: 3 },
      };
      return;
    }

    const chunks = this.responseQueue[this.currentIndex]!;
    this.currentIndex++;

    for (const chunk of chunks) {
      if (signal.aborted) {
        throw new Error('Aborted');
      }
      yield chunk;
    }
  }

  buildSystemPrompt(config: AgentConfig): string {
    return `[Mock System Prompt] You are ${config.name}, an AI agent.

${config.systemPrompt}`;
  }
}
