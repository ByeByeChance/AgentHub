'use client';

import Link from 'next/link';
import { useStore } from '@/store/index';
import { Button } from '@/components/ui/button';
import type { Conversation, AgentMetadata } from '@/store/index';
import { Pin, MoreHorizontal } from 'lucide-react';
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
  const activeId = useStore((s) => s.ui.activeConversationId);
  const pinConversation = useStore((s) => s.pinConversation);
  const archiveConversation = useStore((s) => s.archiveConversation);
  const setActive = useStore((s) => s.setActiveConversation);

  const isActive = activeId === conversation.id;

  const handleClick = () => {
    setActive(conversation.id);
  };

  const relativeTime = getRelativeTime(conversation.createdAt);

  return (
    <Link href={`/chat/${conversation.id}`} onClick={handleClick}>
      <div
        className={`flex items-start gap-3 px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition-colors group ${
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-accent/50'
        }`}
      >
        {/* Agent avatar */}
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-muted flex items-center justify-center text-lg">
          {agent?.emoji ?? '🤖'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm truncate">
              {conversation.title}
            </span>
            <span className="flex-shrink-0 text-xs text-muted-foreground">
              {relativeTime}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {lastPreview}
          </p>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e: React.MouseEvent) => e.preventDefault()}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => pinConversation(conversation.id)}>
              <Pin className="w-3.5 h-3.5 mr-2" />
              {conversation.pinnedAt ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => archiveConversation(conversation.id)}
            >
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Link>
  );
}

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}
