'use client';

import { useTranslations, useFormatter, useNow } from 'next-intl';
import { useStore } from '@/store/index';
import { Button } from '@/components/ui/button';
import type { Conversation, AgentMetadata } from '@/store/interfaces';
import { Pin, MoreHorizontal } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ConversationItemProps {
  conversation: Conversation;
  lastPreview: string;
  agent: AgentMetadata | null;
}

export function ConversationItem({
  conversation,
  lastPreview,
  agent,
}: ConversationItemProps) {
  const t = useTranslations('conversation');
  const format = useFormatter();
  const now = useNow();
  const activeId = useStore((s) => s.ui.activeConversationId);
  const pinConversation = useStore((s) => s.pinConversation);
  const archiveConversation = useStore((s) => s.archiveConversation);
  const setActive = useStore((s) => s.setActiveConversation);

  const isActive = activeId === conversation.id;

  const handleClick = () => {
    setActive(conversation.id);
  };

  const relativeTime = getRelativeTimeText(conversation.createdAt, format, now);

  return (
    <Link href={`/chat/${conversation.id}`} onClick={handleClick}>
      <div
        className={`flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer interactive group ${
          isActive
            ? 'bg-secondary text-secondary-foreground shadow-sm ring-1 ring-border/50'
            : 'hover:bg-muted/70'
        }`}
      >
        {/* Agent avatar */}
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-sm transition-shadow ${
            isActive ? 'bg-primary/10 ring-1 ring-primary/20' : 'bg-muted'
          }`}
        >
          {agent?.emoji ?? '🤖'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`font-medium text-sm truncate ${isActive ? 'font-semibold' : ''}`}>
              {conversation.title}
            </span>
            <span className="flex-shrink-0 text-xs text-muted-foreground">
              {relativeTime}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {lastPreview || t('noConversations')}
          </p>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 flex-shrink-0 opacity-0 group-hover:opacity-100 interactive rounded-lg"
              onClick={(e: React.MouseEvent) => e.preventDefault()}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => pinConversation(conversation.id)}>
              <Pin className="w-3.5 h-3.5 mr-2" />
              {conversation.pinnedAt ? t('unpin') : t('pin')}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => archiveConversation(conversation.id)}
            >
              {t('archive')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Link>
  );
}

function getRelativeTimeText(
  dateStr: string,
  format: ReturnType<typeof useFormatter>,
  now: Date,
): string {
  const date = new Date(dateStr);
  const diffDays = (now.getTime() - date.getTime()) / 86400000;
  if (diffDays < 7) return format.relativeTime(date, now);
  return format.dateTime(date, { dateStyle: 'short' });
}
