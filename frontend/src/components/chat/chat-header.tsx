'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { Conversation, AgentMetadata } from '@/store/interfaces';
import { useStore } from '@/store/index';
import { useMessageSearchQuery, useIsMessageSearchOpen } from '@/store/selectors/message-selectors';
import { OrchestratorDialog } from '@/components/orchestrator/orchestrator-dialog';
import { AgentSwitcher } from './chat-header/agent-switcher';
import { MessageSearchBar } from './chat-header/message-search-bar';
import { HeaderActions } from './chat-header/header-actions';

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
            <AgentSwitcher
              agents={conversationAgents}
              activeAgentId={displayAgentId ?? null}
              onAgentChange={setActiveAgent}
              defaultLabel={t('agent')}
            />
            <span className="text-xs text-muted-foreground">
              · {conversation.mode}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <OrchestratorDialog conversationId={conversation.id} />
        <MessageSearchBar
          isOpen={isMessageSearchOpen}
          query={messageSearchQuery}
          onToggle={toggleMessageSearch}
          onQueryChange={setMessageSearchQuery}
        />
        <HeaderActions
          isPinned={!!conversation.pinnedAt}
          isDetailOpen={isDetailPanelOpen}
          onPin={() => pinConversation(conversation.id)}
          onArchive={() => archiveConversation(conversation.id)}
          onToggleDetail={() => setDetailPanelOpen(!isDetailPanelOpen)}
        />
      </div>
    </div>
  );
}
