export interface ChainVerificationResult {
  valid: boolean;
  brokenAt: string | null;
  expectedHash: string | null;
  actualHash: string | null;
}
