import { describe, it, expect } from 'vitest';
import {
  agents,
  conversations,
  messages,
  artifacts,
  documents,
} from '../../db/schema.js';
import type { MessagePart } from '../../db/index.js';

describe('DB Schema', () => {
  describe('agents table', () => {
    it('should be defined as a PgTable', () => {
      expect(agents).toBeDefined();
      expect(typeof agents).toBe('object');
    });

    it('should have expected column count', () => {
      // Drizzle tables have internal symbol properties
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tableAny = agents as any;
      const cols = tableAny[Symbol.for('drizzle:Columns')] as Record<
        string,
        unknown
      > | undefined;
      expect(cols).toBeDefined();
      const keys = Object.keys(cols ?? {});
      expect(keys.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe('conversations table', () => {
    it('should be defined', () => {
      expect(conversations).toBeDefined();
    });
  });

  describe('messages table', () => {
    it('should be defined', () => {
      expect(messages).toBeDefined();
    });
  });

  describe('artifacts table', () => {
    it('should be defined', () => {
      expect(artifacts).toBeDefined();
    });
  });

  describe('documents table', () => {
    it('should be defined', () => {
      expect(documents).toBeDefined();
    });

    it('should have expected columns including embedding', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tableAny = documents as any;
      const cols = tableAny[Symbol.for('drizzle:Columns')] as Record<
        string,
        unknown
      > | undefined;
      expect(cols).toBeDefined();
      const keys = Object.keys(cols ?? {});
      expect(keys.length).toBeGreaterThanOrEqual(6); // id, content, embedding, metadata, source, created_at
      expect(keys).toContain('embedding');
    });
  });

  describe('MessagePart type', () => {
    it('should allow all valid part types', () => {
      const textPart: MessagePart = { type: 'text', content: 'hello' };
      const thinkingPart: MessagePart = {
        type: 'thinking',
        content: 'reasoning...',
      };
      const toolUsePart: MessagePart = {
        type: 'tool_use',
        toolCallId: 'call_1',
        toolName: 'bash',
        toolInput: { command: 'ls' },
      };
      const toolResultPart: MessagePart = {
        type: 'tool_result',
        toolCallId: 'call_1',
        toolResult: 'file1.txt',
        isError: false,
      };
      const artifactRefPart: MessagePart = {
        type: 'artifact_ref',
        artifactId: 'art_123',
      };

      expect(textPart.type).toBe('text');
      expect(thinkingPart.type).toBe('thinking');
      expect(toolUsePart.type).toBe('tool_use');
      expect(toolResultPart.type).toBe('tool_result');
      expect(artifactRefPart.type).toBe('artifact_ref');
    });
  });
});
