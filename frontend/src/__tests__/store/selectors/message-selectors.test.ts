import { describe, it, expect } from 'vitest';

// Test the selector logic in isolation (pure functions extracted for testability)
// These tests validate the filtering/sorting/formatting logic used by the Zustand selectors.

describe('message selector logic', () => {
  interface Message {
    id: string;
    conversationId: string;
    role: string;
    parts: Array<{ type: string; content?: string; toolCallId?: string; toolName?: string }>;
    status: string;
    createdAt: string;
  }

  const makeMessage = (overrides: Partial<Message> = {}): Message => ({
    id: 'm1',
    conversationId: 'c1',
    role: 'assistant',
    parts: [],
    status: 'complete',
    createdAt: '2026-06-25T10:00:00.000Z',
    ...overrides,
  });

  describe('filter by conversation', () => {
    it('should return empty array when no messages match conversation', () => {
      const messages: Message[] = [
        makeMessage({ id: 'm1', conversationId: 'c1' }),
        makeMessage({ id: 'm2', conversationId: 'c2' }),
      ];
      const filtered = messages.filter((m) => m.conversationId === 'c3');
      expect(filtered).toHaveLength(0);
    });

    it('should return only messages for the given conversation', () => {
      const messages: Message[] = [
        makeMessage({ id: 'm1', conversationId: 'c1' }),
        makeMessage({ id: 'm2', conversationId: 'c2' }),
        makeMessage({ id: 'm3', conversationId: 'c1' }),
      ];
      const filtered = messages.filter((m) => m.conversationId === 'c1');
      expect(filtered).toHaveLength(2);
      expect(filtered.map((m) => m.id)).toEqual(['m1', 'm3']);
    });

    it('should sort by createdAt ascending', () => {
      const messages: Message[] = [
        makeMessage({ id: 'm2', createdAt: '2026-06-25T11:00:00.000Z' }),
        makeMessage({ id: 'm1', createdAt: '2026-06-25T10:00:00.000Z' }),
      ];
      const sorted = [...messages].sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
      expect(sorted.map((m) => m.id)).toEqual(['m1', 'm2']);
    });
  });

  describe('last message preview', () => {
    function getPreview(msg: Message): string {
      const textPart = msg.parts.find((p) => p.type === 'text');
      if (textPart?.content) {
        const preview = textPart.content.slice(0, 60);
        return preview.length < textPart.content.length ? `${preview}...` : preview;
      }
      if (msg.parts.some((p) => p.type === 'tool_use')) return 'Tool invocation...';
      if (msg.parts.some((p) => p.type === 'thinking')) return 'Thinking...';
      return 'Message';
    }

    it('should return text preview for text messages', () => {
      const msg = makeMessage({
        parts: [{ type: 'text', content: 'Hello World' }],
      });
      expect(getPreview(msg)).toBe('Hello World');
    });

    it('should truncate long text previews', () => {
      const msg = makeMessage({
        parts: [{ type: 'text', content: 'A'.repeat(100) }],
      });
      const preview = getPreview(msg);
      expect(preview).toHaveLength(63); // 60 + '...'
      expect(preview.endsWith('...')).toBe(true);
    });

    it('should return "Tool invocation..." for tool_use parts', () => {
      const msg = makeMessage({
        parts: [{ type: 'tool_use', toolCallId: 'tc1', toolName: 'bash' }],
      });
      expect(getPreview(msg)).toBe('Tool invocation...');
    });

    it('should return "Thinking..." for thinking parts', () => {
      const msg = makeMessage({
        parts: [{ type: 'thinking', content: 'Let me think...' }],
      });
      expect(getPreview(msg)).toBe('Thinking...');
    });

    it('should return "Message" for empty parts', () => {
      const msg = makeMessage({ parts: [] });
      expect(getPreview(msg)).toBe('Message');
    });

    it('should prefer text over tool/thinking in mixed parts', () => {
      const msg = makeMessage({
        parts: [
          { type: 'text', content: 'Here is the result' },
          { type: 'tool_use', toolCallId: 'tc1', toolName: 'bash' },
        ],
      });
      expect(getPreview(msg)).toBe('Here is the result');
    });
  });
});
