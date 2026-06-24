'use client';

import { Badge } from '@/components/ui/badge';

interface ArtifactCodeProps {
  code: string;
  language: string;
}

export function ArtifactCode({ code, language }: ArtifactCodeProps) {
  return (
    <div>
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
        <Badge variant="outline" className="text-xs">
          {language}
        </Badge>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono bg-muted/20">
        <code>{code}</code>
      </pre>
    </div>
  );
}
