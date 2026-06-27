import { describe, it, expect, beforeEach } from 'vitest';
import { CrossReview, type CrossReviewResult } from '../../reliability/cross-review.js';
import { MockDeepSeekAdapter } from '../../adapters/mock-deepseek-adapter.js';
import { CostGuard } from '@agenthub/shared/reliability';

function signal(): AbortSignal & { aborted: boolean } {
  return new AbortController().signal;
}

const mockLogger = { info() {}, warn() {}, error() {}, debug() {} } as Parameters<CrossReview['review']>[2];

function acceptedJSON(overrides?: Record<string, unknown>) {
  return JSON.stringify({ accepted: true, reasoning: 'Looks good', ...overrides });
}

function rejectedJSON(reason: string, fix?: string) {
  return JSON.stringify({ accepted: false, reasoning: reason, suggestedFix: fix });
}

describe('CrossReview Integration', () => {
  let adapter: MockDeepSeekAdapter;

  beforeEach(() => {
    adapter = new MockDeepSeekAdapter();
  });

  it('should pass when all reviewers accept (majority_vote)', async () => {
    adapter.setTextSequence([acceptedJSON(), acceptedJSON(), acceptedJSON()]);

    const cr = new CrossReview({ reviewerCount: 3, mode: 'majority_vote' });
    const result = await cr.review(adapter, signal(), mockLogger, {
      output: 'test output', originalRequest: 'test request',
    });

    expect(result.passed).toBe(true);
    expect(result.rounds).toBe(1);
    expect(result.verdicts.length).toBe(3);
  });

  it('should pass when 2/3 accept (majority_vote)', async () => {
    adapter.setTextSequence([acceptedJSON(), acceptedJSON(), rejectedJSON('missing detail', 'add more')]);

    const cr = new CrossReview({ reviewerCount: 3, mode: 'majority_vote' });
    const result = await cr.review(adapter, signal(), mockLogger, {
      output: 'test', originalRequest: 'req',
    });

    expect(result.passed).toBe(true);
  });

  it('should fail when only 1/3 accepts (majority_vote)', async () => {
    // No suggestedFix — prevents auto-fix retry loop
    adapter.setTextSequence([
      acceptedJSON(),
      rejectedJSON('wrong'),
      rejectedJSON('incomplete'),
    ]);

    const cr = new CrossReview({ reviewerCount: 3, mode: 'majority_vote', maxRounds: 1 });
    const result = await cr.review(adapter, signal(), mockLogger, {
      output: 'test', originalRequest: 'req',
    });

    expect(result.passed).toBe(false);
    expect(result.verdicts.length).toBe(3);
  });

  it('should require unanimous in unanimous mode', async () => {
    adapter.setTextSequence([acceptedJSON(), acceptedJSON(), rejectedJSON('one disagrees')]);

    const cr = new CrossReview({ reviewerCount: 3, mode: 'unanimous' });
    const result = await cr.review(adapter, signal(), mockLogger, {
      output: 'test', originalRequest: 'req',
    });

    expect(result.passed).toBe(false);
  });

  it('should block when CostGuard is exhausted', async () => {
    const costGuard = new CostGuard({ maxDailyCost: 0 });
    adapter.setTextSequence([acceptedJSON()]);

    const cr = new CrossReview({ reviewerCount: 1, costGuard, sessionId: 's1' });
    const result = await cr.review(adapter, signal(), mockLogger, {
      output: 'test', originalRequest: 'req',
    });

    expect(result.blockedByCostGuard).toBe(true);
  });
});
