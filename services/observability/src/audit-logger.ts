import { createHash, randomUUID } from 'node:crypto';
import type { ObservabilityDatabase, AuditEntryData } from './repository.interface.js';
import { createAuditEntrySchema } from './validation/audit-schemas.js';
import type { CreateAuditEntryInput } from './validation/audit-schemas.js';
import type { ChainVerificationResult } from './interfaces/audit.interface.js';

// ---- AuditLogger ----
export class AuditLogger {
  private lastHash: string | null = null;

  constructor(private db: ObservabilityDatabase) {}

  async listAll(): Promise<AuditEntryData[]> {
    return this.db.auditLog.listAll();
  }

  async log(input: CreateAuditEntryInput): Promise<AuditEntryData> {
    const parsed = createAuditEntrySchema.parse(input);

    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const previousHash = this.lastHash;
    const currentHash = this.computeSHA256(
      `${id}${parsed.entryType}${JSON.stringify(parsed.payload)}${previousHash ?? ''}${timestamp}`,
    );
    this.lastHash = currentHash;

    const entry: AuditEntryData = {
      id,
      entryType: parsed.entryType,
      payload: parsed.payload,
      previousHash,
      currentHash,
      timestamp,
    };

    await this.db.auditLog.insert(entry);
    return entry;
  }

  async verifyChain(): Promise<ChainVerificationResult> {
    const entries = await this.db.auditLog.listAll();

    if (entries.length === 0) {
      return { valid: true, brokenAt: null, expectedHash: null, actualHash: null };
    }

    let previousHash: string | null = null;

    for (const entry of entries) {
      // Verify the chain link: this entry's previousHash must match the prior entry's currentHash
      if (entry.previousHash !== previousHash) {
        return {
          valid: false,
          brokenAt: entry.id,
          expectedHash: previousHash,
          actualHash: entry.previousHash,
        };
      }

      // Recompute and verify the currentHash
      const expectedHash = this.computeSHA256(
        `${entry.id}${entry.entryType}${JSON.stringify(entry.payload)}${entry.previousHash ?? ''}${entry.timestamp}`,
      );

      if (expectedHash !== entry.currentHash) {
        return {
          valid: false,
          brokenAt: entry.id,
          expectedHash,
          actualHash: entry.currentHash,
        };
      }

      previousHash = entry.currentHash;
    }

    return { valid: true, brokenAt: null, expectedHash: null, actualHash: null };
  }

  private computeSHA256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }
}
