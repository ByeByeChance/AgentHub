'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useStore } from '@/store/index';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Square } from 'lucide-react';

export function MessageInput() {
  const t = useTranslations('chat');
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = useStore((s) => s.ui.isStreaming);
  const activeConversationId = useStore((s) => s.ui.activeConversationId);
  const sendMessage = useStore((s) => s.sendMessage);
  const stopStreaming = useStore((s) => s.stopStreaming);

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || !activeConversationId || isStreaming) return;

    setContent('');
    await sendMessage(activeConversationId, trimmed);

    textareaRef.current?.focus();
  }, [content, activeConversationId, isStreaming, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.target.value);
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    },
    [],
  );

  const hasContent = content.trim().length > 0;

  return (
    <div className="border-t border-border bg-card/80 backdrop-blur-sm px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              activeConversationId
                ? t('typeMessage')
                : t('selectConversation')
            }
            disabled={!activeConversationId}
            className="min-h-[44px] max-h-[200px] resize-none text-sm rounded-2xl px-4 py-2.5 bg-muted/50 border-border/50 focus:bg-background interactive"
            rows={1}
          />
        </div>
        {isStreaming ? (
          <Button
            variant="destructive"
            size="icon"
            className="flex-shrink-0 h-10 w-10 rounded-xl shadow-sm interactive press-scale"
            aria-label={t('stopGeneration')}
            onClick={stopStreaming}
          >
            <Square className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={() => {
              void handleSend();
            }}
            disabled={!hasContent || !activeConversationId}
            size="icon"
            className={`flex-shrink-0 h-10 w-10 rounded-xl shadow-sm interactive press-scale transition-all duration-200 ${
              hasContent && activeConversationId
                ? 'bg-accent hover:bg-accent/90 text-accent-foreground'
                : ''
            }`}
            aria-label={t('sendMessage')}
          >
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
