import { describe, it, expect, beforeEach } from 'vitest';
import { TokenRecorder, UnknownModelError, recordTokenSchema } from './token-recorder.js';
import { InMemoryObservabilityDB } from './db-implementation.js';

describe('TokenRecorder', () => {
  let recorder: TokenRecorder;
  let db: InMemoryObservabilityDB;

  beforeEach(() => {
    db = new InMemoryObservabilityDB();
    recorder = new TokenRecorder(db);
  });

  describe('record', () => {
    it('should record token usage and calculate cost correctly', async () => {
      const result = await recorder.record({
        model: 'deepseek-v4-pro',
        tokensIn: 1000,
        tokensOut: 500,
      });
      expect(result.model).toBe('deepseek-v4-pro');
      expect(result.tokensIn).toBe(1000);
      expect(result.tokensOut).toBe(500);
      // cost = (1000 * 0.00014 + 500 * 0.00028) / 1000 = 0.00028
      expect(result.cost).toBeCloseTo(0.00028, 5);
    });

    it('should calculate cost for deepseek-v4-pro', async () => {
      const result = await recorder.record({
        model: 'deepseek-v4-pro',
        tokensIn: 1000,
        tokensOut: 1000,
      });
      // cost = (1000 * 0.00028 + 1000 * 0.00112) / 1000 = 0.00140
      expect(result.cost).toBeCloseTo(0.0014, 4);
    });

    it('should reject negative token counts', () => {
      expect(() =>
        recordTokenSchema.parse({ model: 'gpt-4o', tokensIn: -1, tokensOut: 0 }),
      ).toThrow();
    });

    it('should throw UnknownModelError for unlisted model', async () => {
      await expect(
        recorder.record({ model: 'unknown-model', tokensIn: 100, tokensOut: 50 }),
      ).rejects.toThrow(UnknownModelError);
    });

    it('should store conversationId and agentId when provided', async () => {
      const result = await recorder.record({
        model: 'gpt-4o',
        tokensIn: 100,
        tokensOut: 50,
        conversationId: 'conv-1',
        agentId: 'agent-1',
      });
      expect(result.conversationId).toBe('conv-1');
      expect(result.agentId).toBe('agent-1');
    });
  });

  describe('getCosts', () => {
    it('should aggregate costs by daily period', async () => {
      await recorder.record({ model: 'gpt-4o', tokensIn: 1000, tokensOut: 500 });
      await recorder.record({ model: 'gpt-4o', tokensIn: 500, tokensOut: 250 });

      const report = await recorder.getCosts({ period: 'daily' });
      expect(report.period).toBe('daily');
      expect(report.totalTokensIn).toBe(1500);
      expect(report.totalTokensOut).toBe(750);
      expect(report.totalCost).toBeGreaterThan(0);
    });

    it('should return zero costs for empty period', async () => {
      const report = await recorder.getCosts({ period: 'daily' });
      expect(report.totalTokensIn).toBe(0);
      expect(report.totalTokensOut).toBe(0);
      expect(report.totalCost).toBe(0);
      expect(report.breakdown).toEqual([]);
    });

    it('should break down costs by model', async () => {
      await recorder.record({ model: 'gpt-4o', tokensIn: 1000, tokensOut: 0 });
      await recorder.record({ model: 'deepseek-v4-pro', tokensIn: 1000, tokensOut: 0 });

      const report = await recorder.getCosts({ period: 'daily' });
      expect(report.breakdown).toHaveLength(2);
      expect(report.breakdown.map(b => b.model).sort()).toEqual(
        ['deepseek-v4-pro', 'gpt-4o'].sort(),
      );
    });
  });
});
