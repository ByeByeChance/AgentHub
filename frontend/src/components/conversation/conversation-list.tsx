'use client';

import { useTranslations } from 'next-intl';
import { usePinnedConversations, useRecentConversations } from '@/store/selectors/conversation-selectors';
import { useLastMessagePreview } from '@/store/selectors/message-selectors';
import { useAgent } from '@/store/selectors/agent-selectors';
import { ConversationItem } from './conversation-item';
import { ConversationSearch } from './conversation-search';
import { ConversationCreateDialog } from './conversation-create-dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { Conversation } from '@/store/interfaces';

function ConversationItemWithHooks({ conv }: { conv: Conversation }) {
  const lastPreview = useLastMessagePreview(conv.id);
  const agent = useAgent(conv.agentIds[0] ?? null);
  return (
    <ConversationItem
      conversation={conv}
      lastPreview={lastPreview}
      agent={agent}
    />
  );
}

export function ConversationList() {
  const t = useTranslations('conversation');
  const pinnedConversations = usePinnedConversations();
  const recentConversations = useRecentConversations();

  return (
    <div className="flex flex-col w-80 h-full border-r border-border bg-card/60 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <h2 className="font-semibold text-sm">{t('title')}</h2>
        <ConversationCreateDialog>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-lg interactive press-scale"
            aria-label={t('newConversation')}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </ConversationCreateDialog>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <ConversationSearch />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2">
        {pinnedConversations.length > 0 && (
          <div className="mb-1">
            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('pinned')}
            </div>
            <div className="stagger-fade-in">
              {pinnedConversations.map((conv) => (
                <ConversationItemWithHooks key={conv.id} conv={conv} />
              ))}
            </div>
          </div>
        )}

        <div>
          {recentConversations.length > 0 && pinnedConversations.length > 0 && (
            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('recent')}
            </div>
          )}
          <div className="stagger-fade-in">
            {recentConversations.map((conv) => (
              <ConversationItemWithHooks key={conv.id} conv={conv} />
            ))}
          </div>
          {pinnedConversations.length === 0 && recentConversations.length === 0 && (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Plus className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t('noConversations')}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {t('createToStart')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
