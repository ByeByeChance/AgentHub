'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useStore } from '@/store/index';
import { MessageSquare } from 'lucide-react';

export default function ChatPage() {
  const t = useTranslations('chat');
  const fetchConversations = useStore((s) => s.fetchConversations);
  const fetchAgents = useStore((s) => s.fetchAgents);
  const setSidebarTab = useStore((s) => s.setSidebarTab);

  useEffect(() => {
    setSidebarTab('chat');
    void fetchConversations();
    void fetchAgents();
  }, [fetchConversations, fetchAgents, setSidebarTab]);

  return (
    <div className="flex-1 flex items-center justify-center bg-muted/30">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
          <MessageSquare className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">{t('agentHub')}</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          {t('selectConversationDesc')}
        </p>
      </div>
    </div>
  );
}
