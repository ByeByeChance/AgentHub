'use client';

import { useStore } from '@/store/index';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';

interface ArtifactRefPartProps {
  artifactId: string;
}

export function ArtifactRefPart({ artifactId }: ArtifactRefPartProps) {
  const artifact = useStore((s) => s.artifacts[artifactId]);
  const setSelectedArtifact = useStore((s) => s.setSelectedArtifact);
  const setDetailPanelOpen = useStore((s) => s.setDetailPanelOpen);
  const setDetailPanelTab = useStore((s) => s.setDetailPanelTab);

  if (!artifact) return null;

  const handleClick = () => {
    setSelectedArtifact(artifactId);
    setDetailPanelTab('artifacts');
    setDetailPanelOpen(true);
  };

  return (
    <button onClick={handleClick} className="inline-flex">
      <Badge
        variant="secondary"
        className="gap-1.5 cursor-pointer hover:bg-accent transition-colors"
      >
        <FileText className="w-3 h-3" />
        {artifact.title}
      </Badge>
    </button>
  );
}
