'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

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

  return (
    <Card
      className={
        isError
          ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
          : 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
      }
    >
      <CardContent className="p-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 w-full text-sm"
        >
          {isError ? (
            <XCircle className="w-4 h-4 text-red-500" />
          ) : (
            <CheckCircle className="w-4 h-4 text-green-500" />
          )}
          <span
            className={`font-medium ${
              isError
                ? 'text-red-900 dark:text-red-100'
                : 'text-green-900 dark:text-green-100'
            }`}
          >
            {isError
              ? t('errorFrom', { toolName })
              : t('resultFrom', { toolName })}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 ml-auto transition-transform ${
              isError ? 'text-red-500' : 'text-green-500'
            } ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>
        {isExpanded && (
          <pre
            className={`mt-2 p-2 rounded text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto ${
              isError
                ? 'bg-red-100/50 dark:bg-red-900/30'
                : 'bg-green-100/50 dark:bg-green-900/30'
            }`}
          >
            {resultStr.length > 2000
              ? `${resultStr.slice(0, 2000)}${t('truncated')}`
              : resultStr}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
