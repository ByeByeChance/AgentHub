'use client';

import type { Components } from 'react-markdown';

/** Renders blockquotes with a left accent border. */
export const blockquoteRenderer: Components['blockquote'] = ({ children }) => {
  return (
    <blockquote className="border-l-[3px] border-primary/30 bg-muted/30 rounded-r-lg pl-4 pr-3 py-2 my-3 italic text-muted-foreground">
      {children}
    </blockquote>
  );
};
