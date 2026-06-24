import { describe, it, expect } from 'vitest';
import { MockDeepSeekAdapter } from '../../adapters/mock-deepseek-adapter.js';
import type { StreamChunk, AgentConfig } from '@agenthub/shared/adapter';

describe('MockDeepSeekAdapter', () => {
  const config: AgentConfig = {
    id: 'test-agent',
    name: 'Test',
    systemPrompt: 'You are a test agent.',
    adapterName: 'mock-deepseek',
    modelId: 'mock',
    toolNames: [],
  };

  function createSignal(): AbortSignal & { aborted: boolean } {
    const ctrl = new AbortController();
    return ctrl.signal;
  }

  async function collectChunks(
    adapter: MockDeepSeekAdapter,
    signal = createSignal(),
  ): Promise<StreamChunk[]> {
    const chunks: StreamChunk[] = [];
    for await (const chunk of adapter.streamChat([], [], signal)) {
      chunks.push(chunk);
    }
    return chunks;
  }

  describe('setTextResponse', () => {
    it('should yield text_delta and done chunks', async () => {
      const adapter = new MockDeepSeekAdapter();
      adapter.setTextResponse('Hello world');

      const chunks = await collectChunks(adapter);

      expect(chunks).toHaveLength(2);
      expect(chunks[0]!.type).toBe('text_delta');
      expect((chunks[0] as { content: string }).content).toBe('Hello world');
      expect(chunks[1]!.type).toBe('done');
    });
  });

  describe('setToolCallSequence', () => {
    it('should yield tool_use_start and tool_use_end chunks', async () => {
      const adapter = new MockDeepSeekAdapter();
      adapter.setToolCallSequence([
        { name: 'bash', input: { command: 'ls' } },
      ]);

      const chunks = await collectChunks(adapter);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]!.type).toBe('tool_use_start');
      expect((chunks[0] as { name: string }).name).toBe('bash');
      expect(chunks[1]!.type).toBe('tool_use_end');
      expect(chunks[2]!.type).toBe('done');
    });

    it('should support multiple tool calls in sequence', async () => {
      const adapter = new MockDeepSeekAdapter();
      adapter.setToolCallSequence(
        [
          { name: 'fs_read', input: { path: 'test.ts' } },
          { name: 'bash', input: { command: 'cat test.ts' } },
        ],
        'Final result',
      );

      // First LLM call: tool call
      const chunks1 = await collectChunks(adapter);
      expect(chunks1[0]!.type).toBe('tool_use_start');
      expect((chunks1[0] as { name: string }).name).toBe('fs_read');
      expect(chunks1[2]!.type).toBe('done');
      expect((chunks1[2] as { finishReason: string }).finishReason).toBe(
        'tool_calls',
      );

      // Second LLM call: another tool call
      const chunks2 = await collectChunks(adapter);
      expect(chunks2[0]!.type).toBe('tool_use_start');
      expect((chunks2[0] as { name: string }).name).toBe('bash');

      // Third LLM call: text response
      const chunks3 = await collectChunks(adapter);
      expect(chunks3[0]!.type).toBe('text_delta');
      expect((chunks3[0] as { content: string }).content).toBe('Final result');
    });
  });

  describe('default behavior', () => {
    it('should return mock text when no responses configured', async () => {
      const adapter = new MockDeepSeekAdapter();
      const chunks = await collectChunks(adapter);

      expect(chunks).toHaveLength(2);
      expect(chunks[0]!.type).toBe('text_delta');
    });
  });

  describe('AbortSignal', () => {
    it('should throw when signal is aborted', async () => {
      const adapter = new MockDeepSeekAdapter();
      adapter.setTextResponse('hello');

      const ctrl = new AbortController();
      ctrl.abort();

      await expect(collectChunks(adapter, ctrl.signal)).rejects.toThrow(
        'Aborted',
      );
    });
  });

  describe('buildSystemPrompt', () => {
    it('should wrap the system prompt with agent name', () => {
      const adapter = new MockDeepSeekAdapter();
      const result = adapter.buildSystemPrompt(config);
      expect(result).toContain('Test');
      expect(result).toContain('You are a test agent');
      expect(result).toContain('Mock System Prompt');
    });
  });
});
