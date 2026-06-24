'use client';

import { useState } from 'react';
import { Wrench, ChevronDown, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ToolUsePartProps {
  toolCallId: string;
  toolName: string;
  toolInput?: Record<string, unknown>;
}

export function ToolUsePart({
  toolCallId: _toolCallId,
  toolName,
  toolInput,
}: ToolUsePartProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
      <CardContent className="p-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 w-full text-sm"
        >
          <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="font-medium text-amber-900 dark:text-amber-100">
            Using tool: <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">{toolName}</code>
          </span>
          <Loader2 className="w-3.5 h-3.5 ml-auto animate-spin text-amber-500" />
          <ChevronDown
            className={`w-3.5 h-3.5 text-amber-500 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>
        {isExpanded && toolInput && (
          <pre className="mt-2 p-2 bg-amber-100/50 dark:bg-amber-900/30 rounded text-xs font-mono overflow-x-auto">
            {JSON.stringify(toolInput, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
