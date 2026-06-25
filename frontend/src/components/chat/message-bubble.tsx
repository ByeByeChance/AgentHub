'use client';

import { useState, useCallback, useRef } from 'react';
import type { Message } from '@/store/interfaces';
import { useStore } from '@/store/index';
import { useMessageSearchMatchIds, useIsStreaming } from '@/store/selectors/message-selectors';
import { getRelativeTime } from '@/lib/time';
import { UserMessage } from './user-message';
import { AssistantMessage } from './assistant-message';
import { HoverActionMenu } from './message-bubble/hover-action-menu';

interface MessageBubbleProps {
  message: Message;
}

/**
 * MessageBubble — dispatcher component.
 *
 * Renders the avatar + hover action menu, then delegates to:
 * - UserMessage     (right-aligned bubble, inline editing)
 * - AssistantMessage (independent blocks per part type)
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isStreaming = message.status === 'streaming';
  const isFailed = message.status === 'failed';
  const isAborted = message.status === 'aborted';
  const canAct = !isStreaming;

  const searchMatches = useMessageSearchMatchIds();
  const isSearchMatch = searchMatches?.has(message.id) ?? false;
  const globalStreaming = useIsStreaming();

  const deleteMessage = useStore((s) => s.deleteMessage);
  const resendMessage = useStore((s) => s.resendMessage);
  const sendMessage = useStore((s) => s.sendMessage);
  const activeConversationId = useStore((s) => s.ui.activeConversationId);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showActions, setShowActions] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userText = message.parts.find((p) => p.type === 'text')?.content ?? '';

  // --- User message handlers ---
  const handleEditStart = useCallback(() => {
    setEditContent(userText);
    setIsEditing(true);
  }, [userText]);

  const handleEditChange = useCallback((value: string) => {
    setEditContent(value);
  }, []);

  const handleEditSave = useCallback(async () => {
    const trimmed = editContent.trim();
    if (!trimmed || !activeConversationId) return;
    await deleteMessage(message.conversationId, message.id);
    await sendMessage(activeConversationId, trimmed);
    setIsEditing(false);
  }, [editContent, activeConversationId, deleteMessage, message, sendMessage]);

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
    setEditContent('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleEditSave();
      }
      if (e.key === 'Escape') handleEditCancel();
    },
    [handleEditSave, handleEditCancel],
  );

  // --- Shared message handlers ---
  const handleDelete = useCallback(async () => {
    await deleteMessage(message.conversationId, message.id);
  }, [deleteMessage, message]);

  const handleResend = useCallback(async () => {
    if (!activeConversationId || globalStreaming) return;
    await resendMessage(activeConversationId, userText);
  }, [activeConversationId, globalStreaming, resendMessage, userText]);

  const relativeTime = getRelativeTime(message.createdAt);

  return (
    <div
      className={`flex gap-3 group ${isUser ? 'flex-row-reverse' : 'flex-row'} ${
        isSearchMatch
          ? 'bg-amber-50 dark:bg-amber-950/40 -mx-3 px-3 py-2 rounded-xl ring-1 ring-amber-200 dark:ring-amber-800'
          : ''
      }`}
      onMouseEnter={() => {
        if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
        setShowActions(true);
      }}
      onMouseLeave={() => {
        hideTimerRef.current = setTimeout(() => setShowActions(false), 150);
      }}
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

      {/* Body — delegates to role-specific sub-component */}
      <div className={`flex-1 min-w-0 ${isUser ? 'flex flex-col items-end' : ''}`}>
        {isUser && (
          <UserMessage
            text={userText}
            isEditing={isEditing}
            editContent={editContent}
            onEditStart={handleEditStart}
            onEditChange={handleEditChange}
            onEditSave={handleEditSave}
            onEditCancel={handleEditCancel}
            onKeyDown={handleKeyDown}
          />
        )}

        {isUser && !isEditing && (
          <span className="text-[10px] text-muted-foreground/50 select-none mt-1">
            {relativeTime}
          </span>
        )}

        {isAssistant && (
          <AssistantMessage
            parts={message.parts}
            isStreaming={isStreaming}
            isFailed={isFailed}
            isAborted={isAborted}
            relativeTime={relativeTime}
          />
        )}

        {/* Hover action menu */}
        {canAct && !isEditing && (
          <HoverActionMenu
            isUser={isUser}
            isVisible={showActions}
            globalStreaming={globalStreaming}
            onEditStart={handleEditStart}
            onResend={handleResend}
            onDelete={handleDelete}
            align={isUser ? 'end' : 'start'}
          />
        )}
      </div>
    </div>
  );
}
