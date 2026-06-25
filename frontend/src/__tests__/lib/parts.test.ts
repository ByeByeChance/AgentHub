import { describe, it, expect } from 'vitest';
import { coalesceParts } from '@/lib/parts';
import type { MessagePart } from '@/store/interfaces';

function tr(
  toolCallId: string,
  toolName: string,
  toolResult: string,
  isError = false,
): MessagePart {
  return { type: 'tool_result', toolCallId, toolName, toolResult, isError };
}

describe('coalesceParts', () => {
  it('should return empty array for empty input', () => {
    expect(coalesceParts([])).toEqual([]);
  });

  it('should keep a single part unchanged', () => {
    const parts: MessagePart[] = [{ type: 'text', content: 'hello' }];
    expect(coalesceParts(parts)).toEqual([{ type: 'text', content: 'hello' }]);
  });

  it('should merge consecutive text parts', () => {
    const parts: MessagePart[] = [
      { type: 'text', content: 'hello ' },
      { type: 'text', content: 'world' },
    ];
    expect(coalesceParts(parts)).toEqual([
      { type: 'text', content: 'hello world' },
    ]);
  });

  it('should merge consecutive thinking parts', () => {
    const parts: MessagePart[] = [
      { type: 'thinking', content: 'step 1: ' },
      { type: 'thinking', content: 'step 2: ' },
      { type: 'thinking', content: 'step 3' },
    ];
    expect(coalesceParts(parts)).toEqual([
      { type: 'thinking', content: 'step 1: step 2: step 3' },
    ]);
  });

  it('should NOT merge tool_use parts (each is distinct action)', () => {
    const parts: MessagePart[] = [
      { type: 'tool_use', toolCallId: '1', toolName: 'read' },
      { type: 'tool_use', toolCallId: '2', toolName: 'write' },
    ];
    expect(coalesceParts(parts)).toHaveLength(2);
  });

  it('should merge consecutive tool_result with same toolCallId', () => {
    const parts: MessagePart[] = [
      tr('1', 'bash', 'line1\n'),
      tr('1', 'bash', 'line2\n'),
      tr('1', 'bash', 'line3'),
    ];
    const result = coalesceParts(parts);
    expect(result).toHaveLength(1);
    expect((result[0] as { toolResult: string }).toolResult).toBe('line1\nline2\nline3');
  });

  it('should NOT merge tool_result with different toolCallId', () => {
    const parts: MessagePart[] = [
      tr('1', 'bash', 'result1'),
      tr('2', 'bash', 'result2'),
    ];
    expect(coalesceParts(parts)).toHaveLength(2);
  });

  it('should merge text between tool calls but keep tool calls separate', () => {
    const parts: MessagePart[] = [
      { type: 'thinking', content: 'let me think...' },
      { type: 'thinking', content: ' more thinking...' },
      { type: 'text', content: 'I will ' },
      { type: 'text', content: 'help you.' },
      { type: 'tool_use', toolCallId: '1', toolName: 'read' },
      tr('1', 'read', 'data'),
      { type: 'text', content: 'done!' },
    ];
    expect(coalesceParts(parts)).toEqual([
      { type: 'thinking', content: 'let me think... more thinking...' },
      { type: 'text', content: 'I will help you.' },
      { type: 'tool_use', toolCallId: '1', toolName: 'read' },
      tr('1', 'read', 'data'),
      { type: 'text', content: 'done!' },
    ]);
  });

  it('should reduce 24 thinking chunks into 1 block', () => {
    const parts: MessagePart[] = Array.from({ length: 24 }, (_, i) => ({
      type: 'thinking' as const,
      content: `chunk${i}`,
    }));
    const result = coalesceParts(parts);
    expect(result).toHaveLength(1);
    expect(result[0]!.content).toHaveLength(158);
  });
});
