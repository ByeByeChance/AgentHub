export interface Artifact {
  id: string;
  conversationId: string;
  type: 'web_app' | 'document' | 'code' | 'image';
  title: string;
  content: unknown;
  version: number;
  parentArtifactId: string | null;
  createdAt: string;
}
