'use client';

import { useTranslations } from 'next-intl';
import { useIsStreaming } from '@/store/selectors/message-selectors';

export function StreamingIndicator() {
  const t = useTranslations('chat');
  const isStreaming = useIsStreaming();

  if (!isStreaming) return null;

  return (
    <div className="flex items-center gap-3 pl-11 py-2 animate-fade-in-up">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/60 rounded-2xl">
        <div className="flex gap-1">
          <span
            className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          {t('agentIsThinking')}
        </span>
      </div>
    </div>
  );
}
