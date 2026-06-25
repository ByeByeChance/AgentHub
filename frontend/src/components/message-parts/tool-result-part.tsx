'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle, XCircle, ChevronDown } from 'lucide-react';

interface ToolResultPartProps {
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError: boolean;
}

export function ToolResultPart({
  toolCallId: _toolCallId,
  toolName,
  result,
  isError,
}: ToolResultPartProps) {
  const t = useTranslations('messageParts');
  const [isExpanded, setIsExpanded] = useState(false);

  const resultStr =
    typeof result === 'string'
      ? result
      : JSON.stringify(result, null, 2);

  const borderColor = isError
    ? 'border-red-300 dark:border-red-700'
    : 'border-green-300 dark:border-green-700';
  const bgColor = isError
    ? 'bg-red-50/40 dark:bg-red-950/15'
    : 'bg-green-50/40 dark:bg-green-950/15';

  return (
    <div className={`border-l-2 ${borderColor} ${bgColor} rounded-r-lg overflow-hidden`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm interactive"
      >
        {isError ? (
          <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
        ) : (
          <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
        )}
        <span
          className={`text-xs ${
            isError
              ? 'text-red-800 dark:text-red-200'
              : 'text-green-800 dark:text-green-200'
          }`}
        >
          {isError
            ? t('errorFrom', { toolName })
            : t('resultFrom', { toolName })}
        </span>
        <ChevronDown
          className={`w-3 h-3 ml-auto flex-shrink-0 transition-transform duration-200 ${
            isError ? 'text-red-400' : 'text-green-400'
          } ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>
      {isExpanded && (
        <pre
          className={`mx-3 mb-2 p-2 rounded text-xs font-mono leading-relaxed overflow-x-auto max-h-48 overflow-y-auto ${
            isError
              ? 'bg-red-100/40 dark:bg-red-900/20 text-red-900 dark:text-red-100'
              : 'bg-green-100/40 dark:bg-green-900/20 text-green-900 dark:text-green-100'
          }`}
        >
          {resultStr.length > 2000
            ? `${resultStr.slice(0, 2000)}${t('truncated')}`
            : resultStr}
        </pre>
      )}
    </div>
  );
}
