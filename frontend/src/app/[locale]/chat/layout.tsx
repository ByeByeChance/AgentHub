'use client';

import { AppShell } from '@/components/layout/app-shell';
import { ConversationList } from '@/components/conversation/conversation-list';
import { SSEProvider } from '@/components/providers/sse-provider';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SSEProvider>
      <AppShell>
        <ConversationList />
        {children}
      </AppShell>
    </SSEProvider>
  );
}
