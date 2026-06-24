// ---- Skill Record ----
export interface SkillRecord {
  id: string;
  name: string;
  description: string;
  currentVersion: string;
  toolSet: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillRepository {
  insert(record: SkillRecord): Promise<void>;
  findById(id: string): Promise<SkillRecord | null>;
  findByName(name: string): Promise<SkillRecord | null>;
  listAll(): Promise<SkillRecord[]>;
  search(query: string): Promise<SkillRecord[]>;
  updateVersion(id: string, version: string): Promise<void>;
  delete(id: string): Promise<void>;
}

// ---- Skill Version Record ----
export interface SkillVersionRecord {
  id: string;
  skillId: string;
  version: string;
  promptTemplate: string;
  toolSet: string[];
  parameterSchema: Record<string, unknown>;
  createdAt: string;
}

export interface SkillVersionRepository {
  insert(record: SkillVersionRecord): Promise<void>;
  findBySkillId(skillId: string): Promise<SkillVersionRecord[]>;
  findBySkillIdAndVersion(skillId: string, version: string): Promise<SkillVersionRecord | null>;
}

// ---- Combined DB ----
export interface SkillDatabase {
  skills: SkillRepository;
  skillVersions: SkillVersionRepository;
}
