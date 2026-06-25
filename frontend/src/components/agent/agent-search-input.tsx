'use client';

import { useTranslations } from 'next-intl';
import { useStore } from '@/store/index';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export function AgentSearchInput() {
  const t = useTranslations('agent');
  const query = useStore((s) => s.ui.agentSearchQuery);
  const setQuery = useStore((s) => s.setAgentSearchQuery);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
      <Input
        placeholder={t('searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-8"
      />
    </div>
  );
}
