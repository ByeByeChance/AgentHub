'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/index';
import { AgentProfile } from '@/components/agent/agent-profile';

export default function AgentDetailPage() {
  const setSidebarTab = useStore((s) => s.setSidebarTab);

  useEffect(() => {
    setSidebarTab('agents');
  }, [setSidebarTab]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <AgentProfile />
      </div>
    </div>
  );
}
