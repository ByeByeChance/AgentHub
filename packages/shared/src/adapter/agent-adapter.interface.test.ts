import { describe, it, expect } from 'vitest';
import type {
  AgentAdapter,
  StreamChunk,
  ToolResult,
  AgentConfig,
  LLMMessage,
  ToolDefinition,
} from './agent-adapter.interface.js';

describe('AgentAdapter Interface', () => {
  describe('StreamChunk discriminated union', () => {
    it('should allow text_delta chunk', () => {
      const chunk: StreamChunk = {
        type: 'text_delta',
        content: 'Hello world',
      };
      expect(chunk.type).toBe('text_delta');
      expect(chunk.content).toBe('Hello world');
    });

    it('should allow thinking_delta chunk', () => {
      const chunk: StreamChunk = {
        type: 'thinking_delta',
        content: 'Let me think about this...',
      };
      expect(chunk.type).toBe('thinking_delta');
    });

    it('should allow tool_use_start chunk', () => {
      const chunk: StreamChunk = {
        type: 'tool_use_start',
        id: 'call_1',
        name: 'bash',
      };
      expect(chunk.type).toBe('tool_use_start');
      expect(chunk.id).toBe('call_1');
      expect(chunk.name).toBe('bash');
    });

    it('should allow tool_use_end chunk with parsed input', () => {
      const chunk: StreamChunk = {
        type: 'tool_use_end',
        id: 'call_1',
        name: 'fs_write',
        input: { path: 'test.txt', content: 'hello' },
      };
      expect(chunk.type).toBe('tool_use_end');
      expect(chunk.input.path).toBe('test.txt');
    });

    it('should allow done chunk with usage stats', () => {
      const chunk: StreamChunk = {
        type: 'done',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
      };
      expect(chunk.type).toBe('done');
      expect(chunk.usage.promptTokens).toBe(100);
    });
  });

  describe('ToolResult', () => {
    it('should represent successful tool result', () => {
      const result: ToolResult = {
        toolCallId: 'call_1',
        name: 'fs_read',
        result: 'file contents here',
        isError: false,
      };
      expect(result.isError).toBe(false);
    });

    it('should represent error tool result', () => {
      const result: ToolResult = {
        toolCallId: 'call_2',
        name: 'bash',
        result: 'command not found',
        isError: true,
      };
      expect(result.isError).toBe(true);
    });
  });

  describe('AgentConfig', () => {
    it('should hold complete agent configuration', () => {
      const config: AgentConfig = {
        id: 'agent-1',
        name: 'Test Agent',
        systemPrompt: 'You are a helpful assistant.',
        adapterName: 'deepseek',
        modelId: 'deepseek-v4-flash',
        toolNames: ['fs_read', 'fs_write', 'bash'],
      };

      expect(config.adapterName).toBe('deepseek');
      expect(config.toolNames).toHaveLength(3);
    });
  });

  describe('LLMMessage', () => {
    it('should support all roles', () => {
      const system: LLMMessage = { role: 'system', content: 'You are...' };
      const user: LLMMessage = {
        role: 'user',
        content: 'Write code',
      };
      const assistant: LLMMessage = {
        role: 'assistant',
        content: 'Here is code',
      };
      const tool: LLMMessage = {
        role: 'tool',
        content: 'result',
        toolCallId: 'call_1',
        name: 'bash',
      };

      expect(system.role).toBe('system');
      expect(user.role).toBe('user');
      expect(assistant.role).toBe('assistant');
      expect(tool.role).toBe('tool');
      expect(tool.toolCallId).toBe('call_1');
    });
  });

  describe('ToolDefinition', () => {
    it('should hold tool definition for LLM function calling', () => {
      const def: ToolDefinition = {
        name: 'fs_read',
        description: 'Read a file from the workspace',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path to the file',
            },
          },
          required: ['path'],
        },
      };
      expect(def.name).toBe('fs_read');
      expect(def.parameters).toBeDefined();
    });
  });

  describe('AgentAdapter stub', () => {
    it('should be implementable as a class', async () => {
      class StubAdapter implements AgentAdapter {
        name = 'stub';

        async *streamChat(
          _messages: LLMMessage[],
          _tools: ToolDefinition[],
          _signal: AbortSignal & { aborted: boolean },
        ): AsyncGenerator<StreamChunk> {
          yield { type: 'text_delta', content: 'stub response' };
          yield {
            type: 'done',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 5 },
          };
        }

        buildSystemPrompt(config: AgentConfig): string {
          return config.systemPrompt;
        }
      }

      const adapter = new StubAdapter();
      expect(adapter.name).toBe('stub');

      const chunks: StreamChunk[] = [];
      const signal = new AbortController().signal;
      for await (const chunk of adapter.streamChat([], [], signal)) {
        chunks.push(chunk);
      }
      expect(chunks).toHaveLength(2);
      expect(chunks[0]!.type).toBe('text_delta');
      expect(chunks[1]!.type).toBe('done');
    });

    it('should be abortable via AbortSignal', async () => {
      class AbortableAdapter implements AgentAdapter {
        name = 'abortable';

        async *streamChat(
          _messages: LLMMessage[],
          _tools: ToolDefinition[],
          signal: AbortSignal & { aborted: boolean },
        ): AsyncGenerator<StreamChunk> {
          for (let i = 0; i < 100; i++) {
            if (signal.aborted) {
              throw new Error('Aborted');
            }
            yield { type: 'text_delta', content: `chunk ${i}` };
            // Small delay to allow abort to be processed
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
          yield {
            type: 'done',
            finishReason: 'stop',
            usage: { promptTokens: 0, completionTokens: 0 },
          };
        }

        buildSystemPrompt(config: AgentConfig): string {
          return config.systemPrompt;
        }
      }

      const controller = new AbortController();
      const adapter = new AbortableAdapter();

      // Abort immediately
      controller.abort();

      const chunks: StreamChunk[] = [];
      try {
        for await (const chunk of adapter.streamChat(
          [],
          [],
          controller.signal,
        )) {
          chunks.push(chunk);
        }
      } catch (_err) {
        // Expected: aborted
      }

      // Should have aborted early
      expect(chunks.length).toBeLessThan(10);
    });
  });
});
