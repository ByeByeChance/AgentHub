'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Wrench, ChevronDown, Loader2 } from 'lucide-react';

interface ToolUsePartProps {
  toolCallId: string;
  toolName: string;
  toolInput?: Record<string, unknown>;
  /** Whether the parent message is still streaming — controls spinner visibility */
  isStreaming?: boolean;
}

export function ToolUsePart({
  toolCallId: _toolCallId,
  toolName,
  toolInput,
  isStreaming = false,
}: ToolUsePartProps) {
  const t = useTranslations('messageParts');
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-l-2 border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/15 rounded-r-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm interactive"
      >
        <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <span className="text-amber-800 dark:text-amber-200 text-xs">
          {t.rich('usingTool', {
            toolName,
            code: (chunks) => (
              <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded text-[11px] font-mono">
                {chunks}
              </code>
            ),
          })}
        </span>
        {isStreaming && (
          <Loader2 className="w-3 h-3 ml-auto animate-spin text-amber-500 flex-shrink-0" />
        )}
        <ChevronDown
          className={`w-3 h-3 text-amber-400 flex-shrink-0 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          } ${!isStreaming ? 'ml-auto' : ''}`}
        />
      </button>
      {isExpanded && toolInput && (
        <pre className="mx-3 mb-2 p-2 bg-amber-100/40 dark:bg-amber-900/20 rounded text-xs font-mono leading-relaxed overflow-x-auto text-amber-900 dark:text-amber-100">
          {JSON.stringify(toolInput, null, 2)}
        </pre>
      )}
    </div>
  );
}
