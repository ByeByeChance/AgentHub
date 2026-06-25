'use client';

import { useTranslations } from 'next-intl';
import { useStore } from '@/store/index';
import { useAgentCategories } from '@/store/selectors/agent-selectors';
import { Badge } from '@/components/ui/badge';

export function AgentCategoryFilter() {
  const t = useTranslations('agent');
  const categories = useAgentCategories();
  const activeCategory = useStore((s) => s.ui.agentCategoryFilter);
  const setCategory = useStore((s) => s.setAgentCategoryFilter);

  return (
    <div className="flex flex-wrap gap-2">
      <Badge
        variant={activeCategory === null ? 'default' : 'outline'}
        className="cursor-pointer text-xs"
        onClick={() => setCategory(null)}
      >
        {t('all')}
      </Badge>
      {categories.map((cat) => (
        <Badge
          key={cat}
          variant={activeCategory === cat ? 'default' : 'outline'}
          className="cursor-pointer text-xs"
          onClick={() => setCategory(cat)}
        >
          {cat}
        </Badge>
      ))}
    </div>
  );
}
