'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface ArtifactMarkdownProps {
  content: string;
}

export function ArtifactMarkdown({ content }: ArtifactMarkdownProps) {
  const components: Components = {
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-4"
        >
          {children}
        </a>
      );
    },
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className ?? '');
      const isInline = !match && !className;
      return isInline ? (
        <code
          className="bg-muted px-1 py-0.5 rounded text-xs font-mono"
          {...props}
        >
          {children}
        </code>
      ) : (
        <pre className="bg-muted rounded-md p-3 overflow-x-auto text-xs font-mono">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
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
