'use client';

import type { Message } from '@/store/interfaces';
import { MessagePartRenderer } from '@/components/message-parts/message-part-renderer';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isStreaming = message.status === 'streaming';
  const isFailed = message.status === 'failed';
  const isAborted = message.status === 'aborted';

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-base">
        {isUser ? '👤' : '🤖'}
      </div>

      {/* Content */}
      <div
        className={`flex-1 min-w-0 space-y-2 ${
          isUser ? 'flex flex-col items-end' : ''
        }`}
      >
        {/* User messages are simple */}
        {isUser && (
          <div className="inline-block max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2 text-sm">
            {message.parts.find((p) => p.type === 'text')?.content ?? ''}
          </div>
        )}

        {/* Assistant messages have parts */}
        {isAssistant &&
          message.parts.map((part, i) => (
            <MessagePartRenderer
              key={`${message.id}-${i}`}
              part={part}
            />
          ))}

        {/* Status indicators */}
        {isStreaming && message.parts.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}

        {isFailed && (
          <div className="text-xs text-destructive bg-destructive/10 px-3 py-1 rounded-md">
            Generation failed
          </div>
        )}

        {isAborted && (
          <div className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-950 px-3 py-1 rounded-md">
            Generation aborted
          </div>
        )}
      </div>
    </div>
  );
}
