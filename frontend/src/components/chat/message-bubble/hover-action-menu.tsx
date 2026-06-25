'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, RotateCw, Trash2 } from 'lucide-react';

interface HoverActionMenuProps {
  isUser: boolean;
  isVisible: boolean;
  globalStreaming: boolean;
  onEditStart: () => void;
  onResend: () => void;
  onDelete: () => void;
  /** Which side the menu should align to */
  align?: 'start' | 'end';
}

/**
 * Hover-triggered action menu with delay-based show/hide.
 *
 * Shows edit (user only), resend/retry, and delete options.
 * Prevents hiding while the dropdown is open.
 */
export function HoverActionMenu({
  isUser,
  isVisible,
  globalStreaming,
  onEditStart,
  onResend,
  onDelete,
  align,
}: HoverActionMenuProps) {
  const t = useTranslations('message');

  return (
    <div
      className={`flex items-center gap-0.5 mt-0.5 transition-all duration-150 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-1 pointer-events-none'
      }`}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost" size="icon"
            className="w-6 h-6 opacity-50 hover:opacity-100 interactive rounded-lg"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-36">
          {isUser && (
            <DropdownMenuItem onClick={onEditStart}>
              <Pencil className="w-3.5 h-3.5 mr-2" />
              {t('edit')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={onResend}
            disabled={globalStreaming}
          >
            <RotateCw className="w-3.5 h-3.5 mr-2" />
            {isUser ? t('resend') : t('retry')}
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            {t('delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
