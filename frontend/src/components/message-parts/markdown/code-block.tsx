'use client';

import type { Components } from 'react-markdown';

/**
 * Renders inline code and fenced code blocks with syntax highlighting header.
 */
export const codeRenderer: Components['code'] = ({ className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className ?? '');
  const isInline = !match && !className;
  if (isInline) {
    return (
      <code
        className="bg-muted/80 px-1.5 py-0.5 rounded-md text-[13px] font-mono text-foreground/85"
        {...props}
      >
        {children}
      </code>
    );
  }
  return (
    <div className="my-3 rounded-xl border border-border/50 bg-muted/60 overflow-hidden">
      {match && (
        <div className="flex items-center px-3 py-1.5 border-b border-border/30 bg-muted/40">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            {match[1]}
          </span>
        </div>
      )}
      <pre className="p-3 overflow-x-auto text-[13px] leading-relaxed font-mono">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
};
