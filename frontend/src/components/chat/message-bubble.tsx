'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { Message } from '@/store/interfaces';
import { useStore } from '@/store/index';
import { MessagePartRenderer } from '@/components/message-parts/message-part-renderer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, RotateCw, Trash2, Check, X } from 'lucide-react';
import { useMessageSearchMatchIds } from '@/store/selectors/message-selectors';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const t = useTranslations('message');
  const isUser = message.role === 'user';
  const searchMatches = useMessageSearchMatchIds();
  const isSearchMatch = searchMatches?.has(message.id) ?? false;
  const isAssistant = message.role === 'assistant';
  const isStreaming = message.status === 'streaming';
  const isFailed = message.status === 'failed';
  const isAborted = message.status === 'aborted';

  const deleteMessage = useStore((s) => s.deleteMessage);
  const resendMessage = useStore((s) => s.resendMessage);
  const sendMessage = useStore((s) => s.sendMessage);
  const activeConversationId = useStore((s) => s.ui.activeConversationId);
  const isStoreStreaming = useStore((s) => s.ui.isStreaming);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showActions, setShowActions] = useState(false);

  const userText = message.parts.find((p) => p.type === 'text')?.content ?? '';

  const handleEdit = useCallback(() => {
    setEditContent(userText);
    setIsEditing(true);
  }, [userText]);

  const handleSaveEdit = useCallback(async () => {
    const trimmed = editContent.trim();
    if (!trimmed || !activeConversationId) return;
    await deleteMessage(message.conversationId, message.id);
    await sendMessage(activeConversationId, trimmed);
    setIsEditing(false);
  }, [editContent, activeConversationId, deleteMessage, message, sendMessage]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent('');
  }, []);

  const handleDelete = useCallback(async () => {
    await deleteMessage(message.conversationId, message.id);
  }, [deleteMessage, message]);

  const handleResend = useCallback(async () => {
    if (!activeConversationId || isStoreStreaming) return;
    await resendMessage(activeConversationId, userText);
  }, [activeConversationId, isStoreStreaming, resendMessage, userText]);

  const canAct = !isStreaming && message.status !== 'streaming';

  return (
    <div
      className={`flex gap-3 group ${isUser ? 'flex-row-reverse' : 'flex-row'} ${
        isSearchMatch
          ? 'bg-amber-50 dark:bg-amber-950/40 rounded-lg -mx-2 px-2 py-1 ring-1 ring-amber-200 dark:ring-amber-800'
          : ''
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-sm ${
          isUser
            ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
            : 'bg-accent/10 text-accent ring-1 ring-accent/20'
        }`}
      >
        {isUser ? '👤' : '🤖'}
      </div>

      {/* Content */}
      <div
        className={`flex-1 min-w-0 space-y-2 ${
          isUser ? 'flex flex-col items-end' : ''
        }`}
      >
        {/* User messages */}
        {isUser && !isEditing && (
          <div className="inline-block max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2 text-sm shadow-sm">
            {userText}
          </div>
        )}

        {/* User message inline editing */}
        {isUser && isEditing && (
          <div className="w-full max-w-[80%] space-y-2 animate-scale-in">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[60px] text-sm resize-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSaveEdit();
                }
                if (e.key === 'Escape') handleCancelEdit();
              }}
            />
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 interactive rounded-lg"
                onClick={() => void handleSaveEdit()}
                disabled={!editContent.trim()}
              >
                <Check className="w-3.5 h-3.5 text-accent" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 interactive rounded-lg"
                onClick={handleCancelEdit}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Assistant messages have parts */}
        {isAssistant &&
          message.parts.map((part, i) => (
            <MessagePartRenderer
              key={`${message.id}-${i}`}
              part={part}
            />
          ))}

        {/* Action menu (hover) */}
        {canAct && showActions && !isEditing && (
          <div
            className={`flex items-center gap-0.5 animate-fade-in-up ${
              isUser ? 'flex-row' : 'flex-row'
            }`}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6 opacity-60 hover:opacity-100 interactive rounded-lg"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isUser ? 'end' : 'start'} className="w-36">
                {isUser && (
                  <DropdownMenuItem onClick={handleEdit}>
                    <Pencil className="w-3.5 h-3.5 mr-2" />
                    {t('edit')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={isUser ? handleResend : () => void handleResend()}
                  disabled={isStoreStreaming}
                >
                  <RotateCw className="w-3.5 h-3.5 mr-2" />
                  {isUser ? t('resend') : t('retry')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  {t('delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Status indicators */}
        {isStreaming && message.parts.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
            <span>{t('thinking')}</span>
          </div>
        )}

        {isFailed && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 px-3 py-1.5 rounded-lg">
            {t('generationFailed')}
          </div>
        )}

        {isAborted && (
          <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-lg">
            {t('generationAborted')}
          </div>
        )}
      </div>
    </div>
  );
}
