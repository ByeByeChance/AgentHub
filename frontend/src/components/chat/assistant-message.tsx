'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { MessagePart } from '@/store/interfaces';
import { coalesceParts } from '@/lib/parts';
import { MessagePartRenderer } from '@/components/message-parts/message-part-renderer';

interface AssistantMessageProps {
  parts: MessagePart[];
  isStreaming: boolean;
  isFailed: boolean;
  isAborted: boolean;
  relativeTime: string;
}

/**
 * Renders an assistant message as a sequence of independent visual blocks.
 *
 * Each part type has its own visual identity:
 * - Text → chat bubble (rounded-2xl bg-muted/20)
 * - Thinking → light left-accent collapsible block
 * - Tool use → amber left-accent block
 * - Tool result → green/red left-accent block
 * - Artifact ref → clickable card
 */
export function AssistantMessage({
  parts,
  isStreaming,
  isFailed,
  isAborted,
  relativeTime,
}: AssistantMessageProps) {
  const t = useTranslations('message');

  // Merge consecutive same-type parts to avoid UI bloat from streaming chunks
  const mergedParts = useMemo(() => coalesceParts(parts), [parts]);

  return (
    <>
      {/* Parts: each as an independent visual block */}
      {mergedParts.length > 0 && (
        <div className="space-y-3 max-w-[85%]">
          {mergedParts.map((part, i) => {
            if (part.type === 'text') {
              return (
                <div
                  key={`part-${i}`}
                  className="bg-muted/20 rounded-2xl rounded-tl-sm px-4 py-2.5 animate-fade-in-up"
                >
                  <MessagePartRenderer part={part} isStreaming={isStreaming} />
                </div>
              );
            }
            return (
              <div key={`part-${i}`} className="animate-fade-in-up">
                <MessagePartRenderer part={part} isStreaming={isStreaming} />
              </div>
            );
          })}
        </div>
      )}

      {/* Loading dots when streaming but no parts yet */}
      {isStreaming && parts.length === 0 && (
        <div className="max-w-[85%] bg-muted/20 rounded-2xl rounded-tl-sm px-4 py-2.5 animate-fade-in-up">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-primary/30 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-primary/30 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-primary/30 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-xs text-muted-foreground">{t('thinking')}</span>
          </div>
        </div>
      )}

      {/* Status badges */}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-muted-foreground/50 select-none">
          {relativeTime}
        </span>

        {isFailed && (
          <span className="inline-flex items-center gap-1 text-xs text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-full font-medium">
            {t('generationFailed')}
          </span>
        )}

        {isAborted && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full font-medium">
            {t('generationAborted')}
          </span>
        )}

        {isStreaming && parts.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            {t('streaming')}
          </span>
        )}
      </div>
    </>
  );
}
