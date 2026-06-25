'use client';

import type { Components } from 'react-markdown';

/** Renders unordered and ordered lists with consistent spacing and markers. */
export const listRenderers: Pick<Components, 'ul' | 'ol' | 'li'> = {
  ul({ children }) {
    return (
      <ul className="list-disc pl-5 mb-3 space-y-1 marker:text-muted-foreground/60">
        {children}
      </ul>
    );
  },
  ol({ children }) {
    return (
      <ol className="list-decimal pl-5 mb-3 space-y-1 marker:text-muted-foreground/60">
        {children}
      </ol>
    );
  },
  li({ children }) {
    return <li className="leading-relaxed pl-1">{children}</li>;
  },
};
