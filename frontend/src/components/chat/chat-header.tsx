'use client';

import type { Conversation, AgentMetadata } from '@/store/interfaces';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store/index';
import { PanelRight, Pin, Archive } from 'lucide-react';

interface ChatHeaderProps {
  conversation: Conversation;
  agent: AgentMetadata | null;
}

export function ChatHeader({ conversation, agent }: ChatHeaderProps) {
  const isDetailPanelOpen = useStore((s) => s.ui.isDetailPanelOpen);
  const setDetailPanelOpen = useStore((s) => s.setDetailPanelOpen);
  const pinConversation = useStore((s) => s.pinConversation);
  const archiveConversation = useStore((s) => s.archiveConversation);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl">{agent?.emoji ?? '🤖'}</span>
        <div className="min-w-0">
          <h1 className="font-semibold text-sm truncate">
            {conversation.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {agent?.name ?? 'Agent'} · {conversation.mode}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          onClick={() => pinConversation(conversation.id)}
          aria-label={conversation.pinnedAt ? 'Unpin' : 'Pin'}
        >
          <Pin
            className={`w-4 h-4 ${conversation.pinnedAt ? 'fill-current' : ''}`}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          onClick={() => archiveConversation(conversation.id)}
          aria-label="Archive"
        >
          <Archive className="w-4 h-4" />
        </Button>
        <Button
          variant={isDetailPanelOpen ? 'secondary' : 'ghost'}
          size="icon"
          className="w-8 h-8"
          onClick={() => setDetailPanelOpen(!isDetailPanelOpen)}
          aria-label="Toggle detail panel"
        >
          <PanelRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
