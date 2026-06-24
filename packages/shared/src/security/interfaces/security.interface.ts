export interface BashValidationResult {
  allowed: boolean;
  blockedReason?: string;
}

export interface PathValidationResult {
  allowed: boolean;
  resolvedPath?: string;
  blockedReason?: string;
}
