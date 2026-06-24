'use client';

import type { Artifact } from '@/store/interfaces';
import { ArtifactIframe } from './artifact-iframe';
import { ArtifactMarkdown } from './artifact-markdown';
import { ArtifactCode } from './artifact-code';

interface ArtifactPreviewProps {
  artifact: Artifact;
}

export function ArtifactPreview({ artifact }: ArtifactPreviewProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-sm">{artifact.title}</h3>
        <p className="text-xs text-muted-foreground">
          v{artifact.version} · {artifact.type}
        </p>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        {artifact.type === 'web_app' && (
          <ArtifactIframe
            htmlContent={
              typeof artifact.content === 'string'
                ? artifact.content
                : JSON.stringify(artifact.content)
            }
          />
        )}
        {artifact.type === 'document' && (
          <div className="p-3">
            <ArtifactMarkdown
              content={
                typeof artifact.content === 'string'
                  ? artifact.content
                  : JSON.stringify(artifact.content)
              }
            />
          </div>
        )}
        {artifact.type === 'code' && (
          <ArtifactCode
            code={
              typeof artifact.content === 'string'
                ? artifact.content
                : JSON.stringify(artifact.content)
            }
            language={detectLanguage(artifact.title)}
          />
        )}
        {artifact.type === 'image' && (
          <div className="p-3">
            <img
              src={
                typeof artifact.content === 'string'
                  ? artifact.content
                  : ''
              }
              alt={artifact.title}
              className="w-full rounded"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function detectLanguage(title: string): string {
  const ext = title.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    go: 'go',
    rs: 'rust',
    html: 'html',
    css: 'css',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
  };
  return ext ? (map[ext] ?? 'text') : 'text';
}
