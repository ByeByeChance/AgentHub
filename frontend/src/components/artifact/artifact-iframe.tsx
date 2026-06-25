'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, AlertTriangle } from 'lucide-react';

interface ArtifactIframeProps {
  htmlContent: string;
  title?: string;
}

export function ArtifactIframe({ htmlContent, title }: ArtifactIframeProps) {
  const t = useTranslations('artifact');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sandboxedHtml = [
    '<meta http-equiv="Content-Security-Policy" content="',
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; ",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; ",
    "connect-src 'none'; ",
    "frame-src 'none'; ",
    "form-action 'none'; ",
    "base-uri 'none'",
    '">',
    htmlContent,
  ].join('');

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);

    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setIsLoading(false);
    };

    iframe.addEventListener('load', handleLoad);
    const timeout = setTimeout(() => {
      if (isLoading) {
        setHasError(true);
        setIsLoading(false);
      }
    }, 10000);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      clearTimeout(timeout);
    };
  }, [sandboxedHtml, isLoading]);

  const handleOpenInTab = useCallback(() => {
    const blob = new Blob([sandboxedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [sandboxedHtml]);

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground font-medium">
          {t('sandboxPreview')}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 rounded-lg interactive"
          onClick={handleOpenInTab}
        >
          <ExternalLink className="w-3 h-3" />
          {t('openInNewTab')}
        </Button>
      </div>

      {/* Iframe container */}
      <div className="relative border border-border/50 rounded-xl overflow-hidden bg-white dark:bg-gray-950 shadow-sm">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading preview...</span>
            </div>
          </div>
        )}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-2 text-center p-4">
              <AlertTriangle className="w-6 h-6 text-destructive/60" />
              <p className="text-xs text-destructive font-medium">
                {t('failedToLoad')}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-lg"
                onClick={handleOpenInTab}
              >
                {t('openInNewTab')}
              </Button>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          sandbox="allow-scripts"
          srcDoc={sandboxedHtml}
          className="w-full min-h-[400px] border-0"
          title={title ?? t('artifactPreview')}
        />
      </div>
    </div>
  );
}
