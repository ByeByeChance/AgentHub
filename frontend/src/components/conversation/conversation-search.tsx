'use client';

import { useTranslations } from 'next-intl';
import { useStore } from '@/store/index';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export function ConversationSearch() {
  const t = useTranslations('conversation');
  const query = useStore((s) => s.ui.conversationSearchQuery);
  const setQuery = useStore((s) => s.setConversationSearchQuery);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        placeholder={t('searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-9 h-9 text-sm rounded-xl bg-muted/50 border-border/30 focus:bg-background interactive"
      />
    </div>
  );
}
