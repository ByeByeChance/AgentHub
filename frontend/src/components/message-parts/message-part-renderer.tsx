'use client';

import type { MessagePart } from '@/store/interfaces';
import { TextPart } from './text-part';
import { ThinkingPart } from './thinking-part';
import { ToolUsePart } from './tool-use-part';
import { ToolResultPart } from './tool-result-part';
import { ArtifactRefPart } from './artifact-ref-part';

interface MessagePartRendererProps {
  part: MessagePart;
  /** Whether the parent message is currently streaming */
  isStreaming?: boolean;
}

export function MessagePartRenderer({ part, isStreaming = false }: MessagePartRendererProps) {
  switch (part.type) {
    case 'text':
      return <TextPart content={part.content ?? ''} />;
    case 'thinking':
      return <ThinkingPart content={part.content ?? ''} />;
    case 'tool_use':
      return (
        <ToolUsePart
          toolCallId={part.toolCallId ?? ''}
          toolName={part.toolName ?? 'unknown'}
          toolInput={part.toolInput}
          isStreaming={isStreaming}
        />
      );
    case 'tool_result':
      return (
        <ToolResultPart
          toolCallId={part.toolCallId ?? ''}
          toolName={part.toolName ?? 'unknown'}
          result={part.toolResult}
          isError={part.isError ?? false}
        />
      );
    case 'artifact_ref':
      return <ArtifactRefPart artifactId={part.artifactId ?? ''} />;
    default:
      return null;
  }
}
