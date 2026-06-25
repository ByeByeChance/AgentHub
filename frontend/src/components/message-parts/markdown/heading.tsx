'use client';

import type { Components } from 'react-markdown';

/** Renders h1–h4 headings with consistent hierarchy styling. */
export const headingRenderers: Pick<Components, 'h1' | 'h2' | 'h3' | 'h4'> = {
  h1({ children }) {
    return (
      <h1 className="text-xl font-bold tracking-tight mt-6 mb-3 first:mt-0 pb-1.5 border-b border-border/30">
        {children}
      </h1>
    );
  },
  h2({ children }) {
    return (
      <h2 className="text-lg font-semibold tracking-tight mt-5 mb-2 first:mt-0">
        {children}
      </h2>
    );
  },
  h3({ children }) {
    return (
      <h3 className="text-base font-semibold mt-4 mb-1.5 first:mt-0">
        {children}
      </h3>
    );
  },
  h4({ children }) {
    return (
      <h4 className="text-sm font-semibold mt-3 mb-1 first:mt-0 text-muted-foreground">
        {children}
      </h4>
    );
  },
};
