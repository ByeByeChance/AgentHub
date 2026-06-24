'use client';

import { useIsStreaming } from '@/store/selectors/message-selectors';

export function StreamingIndicator() {
  const isStreaming = useIsStreaming();

  if (!isStreaming) return null;

  return (
    <div className="flex items-center gap-2 pl-11">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-muted-foreground">
        Agent is thinking...
      </span>
    </div>
  );
}
