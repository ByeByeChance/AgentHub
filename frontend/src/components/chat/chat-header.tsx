'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { Conversation, AgentMetadata } from '@/store/interfaces';
import { useStore } from '@/store/index';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PanelRight, Pin, Archive, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useMessageSearchQuery, useIsMessageSearchOpen } from '@/store/selectors/message-selectors';
import { OrchestratorDialog } from '@/components/orchestrator/orchestrator-dialog';

interface ChatHeaderProps {
  conversation: Conversation;
  agent: AgentMetadata | null;
}

export function ChatHeader({ conversation, agent }: ChatHeaderProps) {
  const t = useTranslations('chat');
  const isDetailPanelOpen = useStore((s) => s.ui.isDetailPanelOpen);
  const activeAgentId = useStore((s) => s.ui.activeAgentId);
  const setDetailPanelOpen = useStore((s) => s.setDetailPanelOpen);
  const setActiveAgent = useStore((s) => s.setActiveAgent);
  const pinConversation = useStore((s) => s.pinConversation);
  const archiveConversation = useStore((s) => s.archiveConversation);
  const agentsMap = useStore((s) => s.agents);
  const agentDetailsMap = useStore((s) => s.agentDetails);
  const toggleMessageSearch = useStore((s) => s.toggleMessageSearch);
  const setMessageSearchQuery = useStore((s) => s.setMessageSearchQuery);
  const isMessageSearchOpen = useIsMessageSearchOpen();
  const messageSearchQuery = useMessageSearchQuery();

  const conversationAgents = useMemo(
    () =>
      conversation.agentIds
        .map((id) => agentDetailsMap[id] ?? agentsMap[id])
        .filter(Boolean) as AgentMetadata[],
    [conversation.agentIds, agentsMap, agentDetailsMap],
  );

  const displayAgentId = activeAgentId ?? conversation.agentIds[0];
  const displayAgent = conversationAgents.find((a) => a.id === displayAgentId) ?? agent;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-xl shadow-sm">
          {displayAgent?.emoji ?? '🤖'}
        </div>
        <div className="min-w-0">
          <h1 className="font-semibold text-sm truncate">
            {conversation.title}
          </h1>
          <div className="flex items-center gap-2">
            {conversationAgents.length > 1 ? (
              <Select
                value={displayAgentId ?? ''}
                onValueChange={(v) => setActiveAgent(v)}
              >
                <SelectTrigger className="h-6 text-xs border-0 bg-transparent px-0 gap-1 min-w-0 w-auto interactive">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {conversationAgents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.emoji} {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">
                {displayAgent?.name ?? t('agent')}
              </p>
            )}
            <span className="text-xs text-muted-foreground">
              · {conversation.mode}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <OrchestratorDialog conversationId={conversation.id} />

        {isMessageSearchOpen ? (
          <div className="flex items-center gap-1 animate-fade-in-right">
            <Input
              value={messageSearchQuery}
              onChange={(e) => setMessageSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-8 w-48 text-xs"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Escape') toggleMessageSearch(); }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 interactive press-scale rounded-lg"
              onClick={toggleMessageSearch}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 interactive press-scale rounded-lg"
            onClick={toggleMessageSearch}
            aria-label={t('searchAria')}
          >
            <Search className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 interactive press-scale rounded-lg"
          onClick={() => pinConversation(conversation.id)}
          aria-label={conversation.pinnedAt ? t('unpin') : t('pin')}
        >
          <Pin
            className={`w-4 h-4 ${conversation.pinnedAt ? 'fill-current text-accent' : ''}`}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 interactive press-scale rounded-lg"
          onClick={() => archiveConversation(conversation.id)}
          aria-label={t('archive')}
        >
          <Archive className="w-4 h-4" />
        </Button>
        <Button
          variant={isDetailPanelOpen ? 'secondary' : 'ghost'}
          size="icon"
          className="w-8 h-8 interactive press-scale rounded-lg"
          onClick={() => setDetailPanelOpen(!isDetailPanelOpen)}
          aria-label={t('toggleDetail')}
        >
          <PanelRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
