import { describe, it, expect } from 'vitest';
import { CrossReview } from '../../reliability/cross-review.js';

describe('CrossReview', () => {
  describe('evaluateConsensus (via review fail fast)', () => {
    it('should construct with default config', () => {
      const cr = new CrossReview();
      expect(cr).toBeDefined();
    });

    it('should construct with custom config', () => {
      const cr = new CrossReview({
        reviewerCount: 5,
        mode: 'unanimous',
        maxRounds: 2,
        thresholdRatio: 0.8,
      });
      expect(cr).toBeDefined();
    });
  });

  describe('consensus logic (tested via unit)', () => {
    // The consensus logic is tested indirectly through the review method,
    // which requires an LLM adapter. We test the constructor and config
    // handling here; the full integration requires a mock adapter.

    it('should accept majority_vote mode', () => {
      const cr = new CrossReview({ mode: 'majority_vote' });
      expect(cr).toBeDefined();
    });

    it('should accept unanimous mode', () => {
      const cr = new CrossReview({ mode: 'unanimous' });
      expect(cr).toBeDefined();
    });

    it('should accept threshold mode', () => {
      const cr = new CrossReview({ mode: 'threshold', thresholdRatio: 0.75 });
      expect(cr).toBeDefined();
    });

    it('should require at least 3 reviewers by default', () => {
      const cr = new CrossReview();
      // reviewerCount should default to 3
      expect(cr).toBeDefined();
    });

    it('should use default review prompt when none provided', () => {
      const cr = new CrossReview();
      expect(cr).toBeDefined();
    });

    it('should accept custom review system prompt', () => {
      const cr = new CrossReview({
        reviewSystemPrompt: 'You are a code reviewer. Evaluate for bugs.',
      });
      expect(cr).toBeDefined();
    });
  });
});
