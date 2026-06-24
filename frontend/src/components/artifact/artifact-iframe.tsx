'use client';

interface ArtifactIframeProps {
  htmlContent: string;
}

export function ArtifactIframe({ htmlContent }: ArtifactIframeProps) {
  return (
    <iframe
      sandbox="allow-scripts"
      srcDoc={htmlContent}
      className="w-full min-h-[400px] border-0"
      title="Artifact preview"
    />
  );
}
