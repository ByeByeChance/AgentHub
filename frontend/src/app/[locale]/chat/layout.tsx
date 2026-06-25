'use client';

import { ConversationList } from '@/components/conversation/conversation-list';
import { SSEProvider } from '@/components/providers/sse-provider';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SSEProvider>
      <ConversationList />
      {children}
    </SSEProvider>
  );
}
