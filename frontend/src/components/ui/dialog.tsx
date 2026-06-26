"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// ── DialogChildContext ──────────────────────────────────────────────
// Portaled child components (Select, DropdownMenu, Popover) register
// their open state here so the Dialog can avoid closing when the user
// interacts with a portaled dropdown inside it.

type DialogChildContextValue = {
  register: () => () => void; // returns unregister function
};

const DialogChildContext = React.createContext<DialogChildContextValue | null>(null);

export function useDialogChildContext() {
  return React.useContext(DialogChildContext);
}

// ── DialogContent ───────────────────────────────────────────────────

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onInteractOutside, onPointerDownOutside, ...props }, ref) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const t = useTranslations('ui');

  // Track how many child portals are currently open.
  const openChildrenRef = React.useRef(new Set<string>());
  const openCountRef = React.useRef(0);

  const dialogChildCtx = React.useMemo<DialogChildContextValue>(() => ({
    register: () => {
      const id = Math.random().toString(36).slice(2);
      openChildrenRef.current.add(id);
      openCountRef.current = openChildrenRef.current.size;
      return () => {
        // Defer the unregister to the next macrotask.  When the user clicks
        // outside a portaled dropdown, Radix fires the child's onOpenChange
        // BEFORE the Dialog's onPointerDownOutside — without this deferral
        // the count would already be 0 by the time the Dialog checks it.
        setTimeout(() => {
          openChildrenRef.current.delete(id);
          openCountRef.current = openChildrenRef.current.size;
        }, 0);
      };
    },
  }), []);

  const hasOpenChildren = React.useCallback(() => openCountRef.current > 0, []);

  const handleInteractOutside = React.useCallback(
    (e: Event) => {
      onInteractOutside?.(e as Parameters<typeof onInteractOutside>[0]);
      if (e.defaultPrevented) return;
      if (hasOpenChildren()) {
        e.preventDefault();
      }
    },
    [onInteractOutside, hasOpenChildren],
  );

  const handlePointerDownOutside = React.useCallback(
    (e: Event) => {
      onPointerDownOutside?.(e as Parameters<typeof onPointerDownOutside>[0]);
      if (e.defaultPrevented) return;
      if (hasOpenChildren()) {
        e.preventDefault();
      }
    },
    [onPointerDownOutside, hasOpenChildren],
  );

  return (
    <DialogChildContext.Provider value={dialogChildCtx}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
            className
          )}
          onInteractOutside={handleInteractOutside}
          onPointerDownOutside={handlePointerDownOutside}
          {...props}
        >
          {children}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">{t('close')}</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogChildContext.Provider>
  );
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
