'use client';

import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

interface DialogFormFieldProps {
  /** Label text displayed above the field */
  label: string;
  /** Optional htmlFor to associate label with the input */
  htmlFor?: string;
  /** The input/select/textarea element */
  children: ReactNode;
  /** Additional class name for the wrapper */
  className?: string;
}

/**
 * Consistent form-field layout for dialogs.
 *
 * Renders a label + child input with uniform spacing and label styling
 * so every dialog field looks the same without repeating Layout boilerplate.
 */
export function DialogFormField({
  label,
  htmlFor,
  children,
  className,
}: DialogFormFieldProps) {
  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}
