'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '@/store/index';
import { useConversation } from '@/store/selectors/conversation-selectors';
import { useConversationMessages } from '@/store/selectors/message-selectors';
import { useAgent } from '@/store/selectors/agent-selectors';
import { ChatHeader } from '@/components/chat/chat-header';
import { MessageList } from '@/components/chat/message-list';
import { MessageInput } from '@/components/chat/message-input';
import { DetailPanel } from '@/components/layout/detail-panel';

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const setActiveConversation = useStore((s) => s.setActiveConversation);
  const setSidebarTab = useStore((s) => s.setSidebarTab);
  const fetchMessages = useStore((s) => s.fetchMessages);
  const fetchAgentDetail = useStore((s) => s.fetchAgentDetail);

  const conversation = useConversation(conversationId ?? null);
  const messages = useConversationMessages(conversationId ?? null);
  const agent = useAgent(conversation?.agentIds[0] ?? null);

  useEffect(() => {
    setSidebarTab('chat');
    if (conversationId) {
      setActiveConversation(conversationId);
      void fetchMessages(conversationId);
      // Fetch agent detail for the detail panel
      const conv = useStore.getState().conversations[conversationId];
      if (conv?.agentIds[0]) {
        void fetchAgentDetail(conv.agentIds[0]);
      }
    }
    return () => {
      setActiveConversation(null);
    };
  }, [
    conversationId,
    setActiveConversation,
    setSidebarTab,
    fetchMessages,
    fetchAgentDetail,
  ]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Conversation not found
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0">
        <ChatHeader conversation={conversation} agent={agent} />
        <MessageList messages={messages} />
        <MessageInput />
      </div>
      <DetailPanel />
    </>
  );
}
