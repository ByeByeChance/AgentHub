'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Brain, ChevronDown } from 'lucide-react';

interface ThinkingPartProps {
  content: string;
}

export function ThinkingPart({ content }: ThinkingPartProps) {
  const t = useTranslations('messageParts');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-l-2 border-primary/20 bg-muted/30 rounded-r-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/30 interactive"
      >
        <Brain className="w-3 h-3 text-primary/50 flex-shrink-0" />
        <span className="font-medium">{t('thinking')}</span>
        <ChevronDown
          className={`w-3 h-3 ml-auto transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-3 pb-2 pt-0.5">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed opacity-80">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}
