import { describe, it, expect } from 'vitest';
import { MockDeepSeekAdapter } from './mock-deepseek-adapter.js';
import type { AgentConfig, StreamChunk } from '@agenthub/shared/adapter';

// DeepSeekAdapter integration tests use MockDeepSeekAdapter to verify the
// adapter interface contract. Real API tests are skipped in CI.
describe('DeepSeekAdapter (via MockDeepSeekAdapter)', () => {
  const config: AgentConfig = {
    id: 'agent-1',
    name: 'Frontend Developer',
    systemPrompt: 'You are a frontend developer.',
    adapterName: 'deepseek',
    modelId: 'deepseek-v4-pro',
    toolNames: ['fs_read', 'fs_write', 'bash'],
  };

  function createSignal(): AbortSignal & { aborted: boolean } {
    const ctrl = new AbortController();
    return ctrl.signal;
  }

  async function collectAll(
    adapter: MockDeepSeekAdapter,
  ): Promise<StreamChunk[]> {
    const chunks: StreamChunk[] = [];
    for await (const chunk of adapter.streamChat([], [], createSignal())) {
      chunks.push(chunk);
    }
    return chunks;
  }

  it('should stream text deltas correctly', async () => {
    const adapter = new MockDeepSeekAdapter();
    adapter.setTextResponse('Some response text');

    const chunks = await collectAll(adapter);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]!.type).toBe('text_delta');
    expect(chunks[chunks.length - 1]!.type).toBe('done');
  });

  it('should format system prompt with agent name', () => {
    const adapter = new MockDeepSeekAdapter();
    const prompt = adapter.buildSystemPrompt(config);
    expect(prompt).toContain(config.name);
    expect(prompt).toContain(config.systemPrompt);
  });

  it('should handle tool call in stream', async () => {
    const adapter = new MockDeepSeekAdapter();
    adapter.setToolCallSequence([
      { name: 'fs_read', input: { path: 'src/App.tsx' } },
    ]);

    const chunks = await collectAll(adapter);
    const hasToolStart = chunks.some((c) => c.type === 'tool_use_start');
    const hasToolEnd = chunks.some((c) => c.type === 'tool_use_end');

    expect(hasToolStart).toBe(true);
    expect(hasToolEnd).toBe(true);
  });

  it('should handle abort signal mid-stream', async () => {
    const adapter = new MockDeepSeekAdapter();
    adapter.setTextResponse('hello');

    const ctrl = new AbortController();
    ctrl.abort();

    await expect(
      (async () => {
        for await (const _chunk of adapter.streamChat(
          [],
          [],
          ctrl.signal,
        )) {
          // should not reach here
        }
      })(),
    ).rejects.toThrow('Aborted');
  });
});
