'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import {
  codeRenderer,
  headingRenderers,
  tableRenderers,
  blockquoteRenderer,
  listRenderers,
} from './markdown';

interface TextPartProps {
  content: string;
}

export function TextPart({ content }: TextPartProps) {
  const components: Components = {
    // Links
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-colors"
        >
          {children}
        </a>
      );
    },

    // Code
    code: codeRenderer,

    // Paragraphs
    p({ children }) {
      return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
    },

    // Headings
    ...headingRenderers,

    // Lists
    ...listRenderers,

    // Blockquote
    blockquote: blockquoteRenderer,

    // Horizontal Rule
    hr() {
      return <hr className="my-4 border-border/40" />;
    },

    // Table
    ...tableRenderers,

    // Strong / Emphasis
    strong({ children }) {
      return <strong className="font-semibold text-foreground">{children}</strong>;
    },
    em({ children }) {
      return <em className="italic">{children}</em>;
    },

    // Images
    img({ src, alt }) {
      return (
        <img
          src={src}
          alt={alt ?? ''}
          className="max-w-full rounded-lg my-3 border border-border/30"
          loading="lazy"
        />
      );
    },
  };

  return (
    <div className="text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
