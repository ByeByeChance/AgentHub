'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useStore } from '@/store/index';
import { useConversation } from '@/store/selectors/conversation-selectors';
import { useConversationMessages } from '@/store/selectors/message-selectors';
import { useAgent } from '@/store/selectors/agent-selectors';
import { ChatHeader } from '@/components/chat/chat-header';
import { MessageList } from '@/components/chat/message-list';
import { MessageInput } from '@/components/chat/message-input';
import { DetailPanel } from '@/components/layout/detail-panel';
import { MessageSquare } from 'lucide-react';

export default function ConversationPage() {
  const t = useTranslations('chat');
  const { conversationId } = useParams<{ conversationId: string }>();
  const setActiveConversation = useStore((s) => s.setActiveConversation);
  const setActiveAgent = useStore((s) => s.setActiveAgent);
  const setSidebarTab = useStore((s) => s.setSidebarTab);
  const fetchConversations = useStore((s) => s.fetchConversations);
  const fetchMessages = useStore((s) => s.fetchMessages);
  const fetchAgents = useStore((s) => s.fetchAgents);
  const fetchAgentDetail = useStore((s) => s.fetchAgentDetail);
  const activeAgentId = useStore((s) => s.ui.activeAgentId);

  const conversation = useConversation(conversationId ?? null);
  const messages = useConversationMessages(conversationId ?? null);

  const displayAgentId = activeAgentId ?? conversation?.agentIds[0] ?? null;
  const agent = useAgent(displayAgentId);

  useEffect(() => {
    setSidebarTab('chat');
    if (!conversationId) return;

    setActiveConversation(conversationId);

    async function load() {
      await fetchConversations();
      await fetchMessages(conversationId!);
      await fetchAgents();

      const conv = useStore.getState().conversations[conversationId!];
      if (conv) {
        const currentActive = useStore.getState().ui.activeAgentId;
        if (!currentActive || !conv.agentIds.includes(currentActive)) {
          setActiveAgent(conv.agentIds[0] ?? null);
        }
        for (const aid of conv.agentIds) {
          void fetchAgentDetail(aid);
        }
      }
    }

    void load();

    return () => {
      setActiveConversation(null);
      setActiveAgent(null);
    };
  }, [
    conversationId,
    setActiveConversation,
    setActiveAgent,
    setSidebarTab,
    fetchConversations,
    fetchMessages,
    fetchAgents,
    fetchAgentDetail,
  ]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4 animate-fade-in-up">
          <MessageSquare className="w-8 h-8 text-muted-foreground/30" />
        </div>
        <p className="text-sm text-muted-foreground animate-fade-in-up">
          {t('conversationNotFound')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <ChatHeader conversation={conversation} agent={agent} />
        <MessageList messages={messages} />
        <MessageInput />
      </div>
      <DetailPanel />
    </>
  );
}
