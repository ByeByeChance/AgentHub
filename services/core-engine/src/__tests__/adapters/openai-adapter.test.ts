import { describe, it, expect } from 'vitest';
import { OpenAIAdapter } from '../../adapters/openai-adapter.js';
import type { AgentConfig } from '@agenthub/shared/adapter';

describe('OpenAIAdapter', () => {
  const config: AgentConfig = {
    id: 'agent-1',
    name: 'Frontend Developer',
    systemPrompt: 'You are a frontend developer.',
    adapterName: 'openai',
    modelId: 'gpt-4.1',
    toolNames: ['fs_read', 'fs_write'],
  };

  describe('constructor', () => {
    it('should set name to openai', () => {
      const adapter = new OpenAIAdapter('test-key');
      expect(adapter.name).toBe('openai');
    });

    it('should accept custom apiKey and baseURL', () => {
      const adapter = new OpenAIAdapter('custom-key', 'https://custom.api.com/v1');
      expect(adapter.name).toBe('openai');
      // Adapter is created without throwing — baseURL is used internally by OpenAI SDK
    });
  });

  describe('buildSystemPrompt', () => {
    it('should include agent name and system prompt', () => {
      const adapter = new OpenAIAdapter('test-key');
      const prompt = adapter.buildSystemPrompt(config);
      expect(prompt).toContain(config.name);
      expect(prompt).toContain(config.systemPrompt);
    });

    it('should include current date', () => {
      const adapter = new OpenAIAdapter('test-key');
      const prompt = adapter.buildSystemPrompt(config);
      const today = new Date().toISOString().split('T')[0]!;
      expect(prompt).toContain(today);
    });
  });

  describe('streamChat abort handling', () => {
    function createAbortedSignal(): AbortSignal & { aborted: boolean } {
      const ctrl = new AbortController();
      ctrl.abort();
      return ctrl.signal;
    }

    it('should throw Aborted when signal is already aborted', async () => {
      const adapter = new OpenAIAdapter('test-key');
      await expect(
        (async () => {
          for await (const _chunk of adapter.streamChat(
            [{ role: 'user', content: 'hi' }],
            [],
            createAbortedSignal(),
          )) {
            // should not reach here
          }
        })(),
      ).rejects.toThrow('Aborted');
    });
  });

  describe('strategy interface compliance', () => {
    it('should implement AgentAdapter interface', () => {
      const adapter = new OpenAIAdapter('test-key');
      // Verify all required members exist
      expect(typeof adapter.name).toBe('string');
      expect(typeof adapter.streamChat).toBe('function');
      expect(typeof adapter.buildSystemPrompt).toBe('function');
    });

    it('should be swappable with DeepSeekAdapter at the interface level', () => {
      // Both implement the same AgentAdapter interface
      // This test verifies OpenAIAdapter has all required interface members
      const adapter = new OpenAIAdapter('test-key');
      const iface: Record<string, unknown> = adapter as unknown as Record<string, unknown>;
      expect(iface['name']).toBe('openai');
      expect(typeof iface['streamChat']).toBe('function');
      expect(typeof iface['buildSystemPrompt']).toBe('function');
    });
  });
});
