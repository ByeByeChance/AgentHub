'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, X } from 'lucide-react';

interface UserMessageProps {
  text: string;
  isEditing: boolean;
  editContent: string;
  onEditStart: () => void;
  onEditChange: (value: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

/**
 * Renders a user's message as a chat bubble (right-aligned by parent).
 * Supports inline editing mode.
 */
export function UserMessage({
  text,
  isEditing,
  editContent,
  onEditChange,
  onEditSave,
  onEditCancel,
  onKeyDown,
}: UserMessageProps) {
  if (isEditing) {
    return (
      <div className="w-full max-w-[80%] space-y-2 animate-scale-in">
        <Textarea
          value={editContent}
          onChange={(e) => onEditChange(e.target.value)}
          className="min-h-[60px] text-sm resize-none rounded-xl"
          autoFocus
          onKeyDown={onKeyDown}
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon"
            className="w-7 h-7 interactive rounded-lg"
            onClick={onEditSave}
            disabled={!editContent.trim()}
          >
            <Check className="w-3.5 h-3.5 text-accent" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="w-7 h-7 interactive rounded-lg"
            onClick={onEditCancel}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-block max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
      {text}
    </div>
  );
}
