'use client';

import { useState, useRef, useCallback } from 'react';
import { useStore } from '@/store/index';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Square } from 'lucide-react';

export function MessageInput() {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = useStore((s) => s.ui.isStreaming);
  const activeConversationId = useStore((s) => s.ui.activeConversationId);
  const sendMessage = useStore((s) => s.sendMessage);

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || !activeConversationId || isStreaming) return;

    setContent('');
    await sendMessage(activeConversationId, trimmed);

    // Focus back on textarea
    textareaRef.current?.focus();
  }, [content, activeConversationId, isStreaming, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // Auto-resize textarea
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.target.value);
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    },
    [],
  );

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            activeConversationId
              ? 'Type a message... (Enter to send, Shift+Enter for newline)'
              : 'Select a conversation to start...'
          }
          disabled={!activeConversationId}
          className="min-h-[40px] max-h-[200px] resize-none text-sm"
          rows={1}
        />
        {isStreaming ? (
          <Button
            variant="destructive"
            size="icon"
            className="flex-shrink-0 h-10 w-10"
            aria-label="Stop generation"
          >
            <Square className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={() => {
              void handleSend();
            }}
            disabled={!content.trim() || !activeConversationId}
            size="icon"
            className="flex-shrink-0 h-10 w-10"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
