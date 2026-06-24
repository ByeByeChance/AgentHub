'use client';

import { useStore } from '@/store/index';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export function ConversationSearch() {
  const query = useStore((s) => s.ui.conversationSearchQuery);
  const setQuery = useStore((s) => s.setConversationSearchQuery);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
      <Input
        placeholder="Search conversations..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-8 h-9 text-sm"
      />
    </div>
  );
}
