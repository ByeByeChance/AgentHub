'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './message-bubble';
import { StreamingIndicator } from './streaming-indicator';
import type { Message } from '@/store/interfaces';
import { useStreamingMessageId } from '@/store/selectors/message-selectors';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingMessageId = useStreamingMessageId();

  // Auto-scroll to bottom when new messages arrive or streaming
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Scroll the nearest scrollable parent
    const scrollParent = el.closest('[data-radix-scroll-area-viewport]');
    if (scrollParent) {
      scrollParent.scrollTop = scrollParent.scrollHeight;
    }
  }, [messages.length, streamingMessageId]);

  return (
    <ScrollArea className="flex-1">
      <div ref={scrollRef} className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full min-h-[200px] text-sm text-muted-foreground">
            No messages yet. Start a conversation!
          </div>
        )}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <StreamingIndicator />
      </div>
    </ScrollArea>
  );
}
