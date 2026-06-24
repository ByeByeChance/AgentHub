import type { SkillVersionRecord } from '../repository.interface.js';

export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  currentVersion: string;
  toolSet: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillFull extends SkillMetadata {
  versions: SkillVersionRecord[];
}
