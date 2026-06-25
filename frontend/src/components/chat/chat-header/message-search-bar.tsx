'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';

interface MessageSearchBarProps {
  isOpen: boolean;
  query: string;
  onToggle: () => void;
  onQueryChange: (query: string) => void;
}

/**
 * Toggleable message search — shows a search icon when closed,
 * expands to an inline input when open.
 */
export function MessageSearchBar({
  isOpen,
  query,
  onToggle,
  onQueryChange,
}: MessageSearchBarProps) {
  const t = useTranslations('chat');

  if (isOpen) {
    return (
      <div className="flex items-center gap-1 animate-fade-in-right">
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-8 w-48 text-xs"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Escape') onToggle(); }}
        />
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 interactive press-scale rounded-lg"
          onClick={onToggle}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="w-8 h-8 interactive press-scale rounded-lg"
      onClick={onToggle}
      aria-label={t('searchAria')}
    >
      <Search className="w-4 h-4" />
    </Button>
  );
}
