'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Pin, Archive, PanelRight } from 'lucide-react';

interface HeaderActionsProps {
  isPinned: boolean;
  isDetailOpen: boolean;
  onPin: () => void;
  onArchive: () => void;
  onToggleDetail: () => void;
}

/**
 * Chat header action buttons: pin, archive, toggle detail panel.
 */
export function HeaderActions({
  isPinned,
  isDetailOpen,
  onPin,
  onArchive,
  onToggleDetail,
}: HeaderActionsProps) {
  const t = useTranslations('chat');

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="w-8 h-8 interactive press-scale rounded-lg"
        onClick={onPin}
        aria-label={isPinned ? t('unpin') : t('pin')}
      >
        <Pin
          className={`w-4 h-4 ${isPinned ? 'fill-current text-accent' : ''}`}
        />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="w-8 h-8 interactive press-scale rounded-lg"
        onClick={onArchive}
        aria-label={t('archive')}
      >
        <Archive className="w-4 h-4" />
      </Button>
      <Button
        variant={isDetailOpen ? 'secondary' : 'ghost'}
        size="icon"
        className="w-8 h-8 interactive press-scale rounded-lg"
        onClick={onToggleDetail}
        aria-label={t('toggleDetail')}
      >
        <PanelRight className="w-4 h-4" />
      </Button>
    </>
  );
}
