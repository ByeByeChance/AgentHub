'use client';

import { useState } from 'react';
import { Brain, ChevronDown } from 'lucide-react';

interface ThinkingPartProps {
  content: string;
}

export function ThinkingPart({ content }: ThinkingPartProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <Brain className="w-3.5 h-3.5" />
        <span className="font-medium">Thinking...</span>
        <ChevronDown
          className={`w-3.5 h-3.5 ml-auto transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-3 py-2 border-t border-border bg-muted/30">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}
