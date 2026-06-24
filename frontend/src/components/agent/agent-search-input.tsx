'use client';

import { useStore } from '@/store/index';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export function AgentSearchInput() {
  const query = useStore((s) => s.ui.agentSearchQuery);
  const setQuery = useStore((s) => s.setAgentSearchQuery);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
      <Input
        placeholder="Search agents..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-8"
      />
    </div>
  );
}
