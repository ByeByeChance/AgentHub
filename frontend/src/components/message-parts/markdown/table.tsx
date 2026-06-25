'use client';

import type { Components } from 'react-markdown';

/** Renders markdown tables with scrollable container and styled header/rows. */
export const tableRenderers: Pick<Components, 'table' | 'thead' | 'th' | 'td'> = {
  table({ children }) {
    return (
      <div className="my-3 overflow-x-auto rounded-lg border border-border/40">
        <table className="w-full text-sm">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return (
      <thead className="bg-muted/40 border-b border-border/30">
        {children}
      </thead>
    );
  },
  th({ children }) {
    return (
      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="px-3 py-1.5 border-t border-border/20">{children}</td>
    );
  },
};
