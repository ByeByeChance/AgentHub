import type { MessagePart } from '@/store/interfaces';

/**
 * Coalesce consecutive parts that should be visually merged.
 *
 * SSE streaming may produce many small chunks of the same logical content.
 * This merges them so the UI doesn't render N separate blocks.
 *
 * Merge rules:
 * - text / thinking: consecutive same-type → concatenated
 * - tool_result: consecutive with same toolCallId → concatenated (streamed result chunks)
 * - tool_use, artifact_ref: never merged (each is a distinct action)
 */
export function coalesceParts(parts: MessagePart[]): MessagePart[] {
  if (parts.length === 0) return [];

  const coalesced: MessagePart[] = [];
  let cursor: MessagePart = { ...parts[0]! };

  for (let i = 1; i < parts.length; i++) {
    const current = parts[i]!;

    if (shouldMerge(cursor, current)) {
      cursor = mergeInto(cursor, current);
    } else {
      coalesced.push(cursor);
      cursor = { ...current };
    }
  }
  coalesced.push(cursor);

  return coalesced;
}

function shouldMerge(a: MessagePart, b: MessagePart): boolean {
  if (a.type !== b.type) return false;

  switch (a.type) {
    case 'text':
    case 'thinking':
      return true;
    case 'tool_result':
      // Only merge consecutive results for the SAME tool call
      return a.toolCallId === b.toolCallId;
    default:
      return false;
  }
}

function mergeInto(target: MessagePart, source: MessagePart): MessagePart {
  switch (target.type) {
    case 'text':
    case 'thinking':
      return {
        ...target,
        content: (target.content ?? '') + (source.content ?? ''),
      };
    case 'tool_result':
      return {
        ...target,
        isError: target.isError || source.isError,
        toolResult: mergeResult(target.toolResult, source.toolResult),
      };
    default:
      return target;
  }
}

function mergeResult(a: unknown, b: unknown): unknown {
  if (typeof a === 'string' && typeof b === 'string') return a + b;
  // For non-string results, prefer the latest
  return b ?? a;
}
