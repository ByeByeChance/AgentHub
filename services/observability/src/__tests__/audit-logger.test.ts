import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogger, createAuditEntrySchema } from '../audit-logger.js';
import { InMemoryObservabilityDB } from '../db-implementation.js';

describe('AuditLogger', () => {
  let logger: AuditLogger;
  let db: InMemoryObservabilityDB;

  beforeEach(() => {
    db = new InMemoryObservabilityDB();
    logger = new AuditLogger(db);
  });

  describe('log', () => {
    it('should create first entry with null previousHash', async () => {
      const entry = await logger.log({
        entryType: 'agent.run.start',
        payload: { agentId: 'a1' },
      });
      expect(entry.previousHash).toBeNull();
      expect(entry.currentHash).toBeDefined();
      expect(entry.currentHash).toHaveLength(64); // SHA-256 hex
      expect(entry.entryType).toBe('agent.run.start');
    });

    it('should chain entries with previousHash pointing to prior currentHash', async () => {
      const e1 = await logger.log({ entryType: 'test.1', payload: {} });
      const e2 = await logger.log({ entryType: 'test.2', payload: {} });
      const e3 = await logger.log({ entryType: 'test.3', payload: {} });

      expect(e2.previousHash).toBe(e1.currentHash);
      expect(e3.previousHash).toBe(e2.currentHash);
    });

    it('should verify intact chain returns valid', async () => {
      await logger.log({ entryType: 'a', payload: {} });
      await logger.log({ entryType: 'b', payload: {} });
      await logger.log({ entryType: 'c', payload: {} });

      const result = await logger.verifyChain();
      expect(result.valid).toBe(true);
      expect(result.brokenAt).toBeNull();
    });

    it('should verify empty chain as valid', async () => {
      const result = await logger.verifyChain();
      expect(result.valid).toBe(true);
    });

    it('should detect tampered chain when hash is broken', async () => {
      await logger.log({ entryType: 'a', payload: {} });
      await logger.log({ entryType: 'b', payload: {} });

      // Tamper with e1's payload in the database
      const entries = await db.auditLog.listAll();
      entries[0]!.payload = { tampered: true };

      const result = await logger.verifyChain();
      expect(result.valid).toBe(false);
    });
  });

  describe('Zod validation', () => {
    it('should reject empty entryType', () => {
      expect(() => createAuditEntrySchema.parse({ entryType: '' })).toThrow();
    });

    it('should accept valid input with default payload', () => {
      const parsed = createAuditEntrySchema.parse({ entryType: 'test' });
      expect(parsed.entryType).toBe('test');
      expect(parsed.payload).toEqual({});
    });
  });
});
