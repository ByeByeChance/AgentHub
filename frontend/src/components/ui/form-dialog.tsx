'use client';

import { useState, useCallback, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface FormDialogProps {
  /** Controlled open state */
  open: boolean;
  /** Controlled open-change handler */
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: string | ReactNode;

  /** Form body content */
  children: ReactNode;

  /* ── Footer buttons (optional) ── */

  /** Cancel button label — omit to hide cancel button */
  cancelLabel?: string;
  /** Submit button label (string or ReactNode for icon+text) */
  submitLabel?: string | ReactNode;
  /** Called when submit is clicked. Return value is awaited. */
  onSubmit?: () => void | Promise<void>;
  /** When true, the submit button is disabled */
  submitDisabled?: boolean;
  /** When true, the submit button shows a loading spinner */
  submitLoading?: boolean;
  /** Additional class names for the submit button */
  submitClassName?: string;

  /* ── Dialog config ── */

  /** Optional trigger element — when omitted, open must be controlled externally */
  trigger?: ReactNode;
  /** Additional class name for DialogContent */
  className?: string;
  /** Max-width preset */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';

}

const MAX_WIDTH_CLASS: Record<string, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
};

/**
 * Reusable form-in-dialog shell.
 *
 * Features:
 * - Auto-protects portaled child content (Select, DropdownMenu, Popover) from
 *   closing the Dialog when clicked — handled by the base DialogContent.
 * - Consistent header + title styling
 * - Optional cancel / submit footer buttons
 * - Supports async onSubmit with internal loading state
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  children,
  cancelLabel,
  submitLabel,
  onSubmit,
  submitDisabled = false,
  submitLoading = false,
  submitClassName,
  trigger,
  className,
  maxWidth = 'lg',
}: FormDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const isBusy = submitting || submitLoading;

  const handleSubmit = useCallback(async () => {
    if (!onSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }, [onSubmit, onOpenChange]);

  const hasFooter = cancelLabel || submitLabel;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent
        className={`${MAX_WIDTH_CLASS[maxWidth] ?? 'sm:max-w-lg'} overflow-hidden p-5 gap-3 ${className ?? ''}`}
      >
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        {/* Form body — consumer provides field content */}
        <div className="space-y-4 min-w-0">{children}</div>

        {/* Footer actions */}
        {hasFooter && (
          <div className="flex justify-end gap-2 pt-1">
            {cancelLabel && (
              <Button
                variant="outline"
                className="rounded-lg h-9 text-sm"
                onClick={() => onOpenChange(false)}
                disabled={isBusy}
              >
                {cancelLabel}
              </Button>
            )}
            {submitLabel && (
              <Button
                className={`rounded-lg h-9 text-sm bg-accent hover:bg-accent/90 text-accent-foreground ${submitClassName ?? ''}`}
                onClick={handleSubmit}
                disabled={submitDisabled || isBusy}
              >
                {isBusy ? '...' : submitLabel}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
