'use client';

import { usePinnedConversations, useRecentConversations } from '@/store/selectors/conversation-selectors';
import { useLastMessagePreview } from '@/store/selectors/message-selectors';
import { useAgent } from '@/store/selectors/agent-selectors';
import { ConversationItem } from './conversation-item';
import { ConversationSearch } from './conversation-search';
import { ConversationCreateDialog } from './conversation-create-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus } from 'lucide-react';

export function ConversationList() {
  const pinnedConversations = usePinnedConversations();
  const recentConversations = useRecentConversations();

  return (
    <div className="flex flex-col w-80 h-full border-r border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h2 className="font-semibold text-sm">Conversations</h2>
        <ConversationCreateDialog>
          <Button variant="ghost" size="icon" className="w-8 h-8" aria-label="New conversation">
            <Plus className="w-4 h-4" />
          </Button>
        </ConversationCreateDialog>
      </div>

      {/* Search */}
      <div className="p-2">
        <ConversationSearch />
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {pinnedConversations.length > 0 && (
          <div className="mb-2">
            <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pinned
            </div>
            {pinnedConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                lastPreview={useLastMessagePreview(conv.id)}
                agent={useAgent(conv.agentIds[0] ?? null)}
              />
            ))}
          </div>
        )}

        <div>
          {recentConversations.length > 0 && pinnedConversations.length > 0 && (
            <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recent
            </div>
          )}
          {recentConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              lastPreview={useLastMessagePreview(conv.id)}
              agent={useAgent(conv.agentIds[0] ?? null)}
            />
          ))}
          {pinnedConversations.length === 0 && recentConversations.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No conversations yet.
              <br />
              Create one to get started.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
