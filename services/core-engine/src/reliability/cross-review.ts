import type { AgentAdapter, LLMMessage } from '@agenthub/shared/adapter';
import type { Logger } from '@agenthub/shared/logging';
import type { CostGuard } from '@agenthub/shared/reliability';

/**
 * Layer 5 — Cross-Review: multiple agents independently review outputs,
 * then a configurable consensus mechanism decides the final verdict.
 *
 * Consensus modes:
 * - majority_vote: > 50% agreement required
 * - unanimous:      all reviewers must agree
 * - threshold:      N out of M must agree (configurable ratio)
 *
 * If consensus fails, auto-fix retries up to `maxRounds` times.
 * Protected by CostGuard to prevent runaway review costs.
 */

export type ConsensusMode = 'majority_vote' | 'unanimous' | 'threshold';

export interface CrossReviewConfig {
  /** Number of independent reviewer agents. Default: 3 */
  reviewerCount?: number;
  /** Consensus mode. Default: 'majority_vote' */
  mode?: ConsensusMode;
  /** Threshold ratio when mode is 'threshold' (e.g. 0.75 = 3 out of 4). Default: 0.67 */
  thresholdRatio?: number;
  /** Maximum auto-fix rounds when consensus fails. Default: 3 */
  maxRounds?: number;
  /** System prompt for reviewer agents. */
  reviewSystemPrompt?: string;
  /**
   * Optional cost guard to prevent runaway review costs.
   * Checked before each review round and auto-fix call.
   */
  costGuard?: CostGuard;
  /** Session ID for cost guard tracking. */
  sessionId?: string;
}

export interface ReviewVerdict {
  accepted: boolean;
  reviewerIndex: number;
  reasoning: string;
  suggestedFix?: string;
}

export interface CrossReviewResult {
  /** Final verdict: true = pass, false = fail */
  passed: boolean;
  /** Individual reviewer verdicts */
  verdicts: ReviewVerdict[];
  /** Consensus mode used */
  mode: ConsensusMode;
  /** Number of rounds taken */
  rounds: number;
  /** Aggregated feedback (passed) or aggregated reasons for failure */
  summary: string;
  /** If blocked by cost guard, the reason */
  blockedByCostGuard?: boolean;
}

const DEFAULT_REVIEW_PROMPT = `You are a critical reviewer. Evaluate the following output for correctness, completeness, and safety.

Review criteria:
1. Factual accuracy — are there any hallucinations or incorrect claims?
2. Completeness — does it fully address the original request?
3. Safety — is there any harmful, biased, or dangerous content?
4. Instruction following — does it comply with the given constraints?

Respond with a JSON object:
{
  "accepted": true/false,
  "reasoning": "detailed explanation",
  "suggestedFix": "if not accepted, suggest how to fix"
}`;

/** Non-optional core config fields, initialized with defaults. */
type ResolvedCoreConfig = Required<Pick<CrossReviewConfig, 'reviewerCount' | 'mode' | 'thresholdRatio' | 'maxRounds' | 'reviewSystemPrompt'>>;

export class CrossReview {
  private readonly config: ResolvedCoreConfig;
  private readonly costGuard?: CostGuard;
  private readonly sessionId?: string;

  constructor(config: CrossReviewConfig = {}) {
    this.config = {
      reviewerCount: config.reviewerCount ?? 3,
      mode: config.mode ?? 'majority_vote',
      thresholdRatio: config.thresholdRatio ?? 0.67,
      maxRounds: config.maxRounds ?? 3,
      reviewSystemPrompt: config.reviewSystemPrompt ?? DEFAULT_REVIEW_PROMPT,
    };
    this.costGuard = config.costGuard;
    this.sessionId = config.sessionId;
  }

  /**
   * Review an output through multiple independent LLM reviewers.
   *
   * If the output fails review, it can be auto-fixed using the
   * reviewer's suggestedFix and re-reviewed, up to maxRounds times.
   *
   * @param adapter   LLM adapter to run review calls
   * @param signal    AbortSignal for cancellation
   * @param logger    Logger for review diagnostics
   * @param params    The output to review and its original request
   */
  async review(
    adapter: AgentAdapter,
    signal: AbortSignal & { aborted: boolean },
    logger: Logger,
    params: {
      output: string;
      originalRequest: string;
      constraints?: string[];
    },
  ): Promise<CrossReviewResult> {
    const allVerdicts: ReviewVerdict[] = [];
    let currentOutput = params.output;
    let rounds = 0;

    while (rounds <= this.config.maxRounds) {
      if (signal.aborted) {
        return {
          passed: false,
          verdicts: allVerdicts,
          mode: this.config.mode,
          rounds,
          summary: 'Review aborted',
        };
      }

      // CostGuard check before running reviewer LLM calls
      if (this.costGuard) {
        // Estimate: each reviewer call ~2000 input + ~200 output tokens
        const estTokensIn = this.config.reviewerCount * 2000;
        const estTokensOut = this.config.reviewerCount * 200;
        const costCheck = this.costGuard.check({
          tokensIn: estTokensIn,
          tokensOut: estTokensOut,
          cost: (estTokensIn + estTokensOut) / 1_000_000 * 2.0,
          sessionId: this.sessionId,
        });
        if (!costCheck.allowed) {
          logger.warn('CrossReview blocked by CostGuard', {
            round: rounds,
            reason: costCheck.reason,
          });
          return {
            passed: false,
            verdicts: allVerdicts,
            mode: this.config.mode,
            rounds,
            summary: `Review blocked by cost guard: ${costCheck.reason}`,
            blockedByCostGuard: true,
          };
        }
      }

      // Run independent reviews in parallel
      const verdicts = await this.runReviewers(
        adapter,
        signal,
        currentOutput,
        params.originalRequest,
        params.constraints,
      );
      allVerdicts.push(...verdicts);
      rounds++;

      const passed = this.evaluateConsensus(verdicts);
      if (passed) {
        return {
          passed: true,
          verdicts,
          mode: this.config.mode,
          rounds,
          summary: this.buildSummary(verdicts),
        };
      }

      // Consensus failed — try auto-fix if we have suggested fixes
      if (rounds <= this.config.maxRounds) {
        const fixes = verdicts
          .filter((v) => !v.accepted && v.suggestedFix)
          .map((v) => v.suggestedFix!);

        if (fixes.length > 0) {
          // CostGuard check before auto-fix LLM call
          if (this.costGuard) {
            const fixCheck = this.costGuard.check({
              tokensIn: 3000,
              tokensOut: 2000,
              cost: (3000 + 2000) / 1_000_000 * 2.0,
              sessionId: this.sessionId,
            });
            if (!fixCheck.allowed) {
              logger.warn('CrossReview auto-fix blocked by CostGuard');
              break;
            }
          }

          const fixMessage: LLMMessage[] = [
            { role: 'system', content: 'You are fixing an output that was rejected by reviewers. Apply the suggested fixes.' },
            { role: 'user', content: `Original request: ${params.originalRequest}\n\nOutput to fix: ${currentOutput}\n\nReviewer feedback:\n${fixes.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nProduce the corrected output.` },
          ];

          let fixedOutput = '';
          try {
            for await (const chunk of adapter.streamChat(fixMessage, [], signal)) {
              if (chunk.type === 'text_delta') {
                fixedOutput += chunk.content;
              }
            }
          } catch (err) {
            logger.warn('Auto-fix generation failed', { error: String(err) });
            break;
          }

          if (fixedOutput) {
            currentOutput = fixedOutput;
            logger.info('Auto-fix applied, re-reviewing', { round: rounds });
            continue;
          }
        }
      }

      // No fixes available or max rounds exceeded
      break;
    }

    return {
      passed: false,
      verdicts: allVerdicts,
      mode: this.config.mode,
      rounds,
      summary: this.buildSummary(allVerdicts),
    };
  }

  // ── private ──

  private async runReviewers(
    adapter: AgentAdapter,
    signal: AbortSignal,
    output: string,
    originalRequest: string,
    constraints?: string[],
  ): Promise<ReviewVerdict[]> {
    const verdicts: ReviewVerdict[] = [];
    const reviewerMessages: LLMMessage[] = [
      { role: 'system', content: this.config.reviewSystemPrompt },
      {
        role: 'user',
        content: [
          `Original request: ${originalRequest}`,
          ...(constraints ?? []).map((c) => `Constraint: ${c}`),
          `\nOutput to review:\n${output.slice(0, 8000)}`,
        ].join('\n'),
      },
    ];

    for (let i = 0; i < this.config.reviewerCount; i++) {
      if (signal.aborted) break;

      try {
        let rawOutput = '';
        for await (const chunk of adapter.streamChat(reviewerMessages, [], signal)) {
          if (chunk.type === 'text_delta') {
            rawOutput += chunk.content;
          }
        }

        // Parse JSON from reviewer response
        const jsonMatch = rawOutput.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, rawOutput];
        const jsonText = (jsonMatch[1] ?? rawOutput).trim();
        const parsed = JSON.parse(jsonText) as {
          accepted?: boolean;
          reasoning?: string;
          suggestedFix?: string;
        };

        verdicts.push({
          accepted: parsed.accepted ?? false,
          reviewerIndex: i,
          reasoning: parsed.reasoning ?? 'No reasoning provided',
          suggestedFix: parsed.suggestedFix,
        });
      } catch (err) {
        // Reviewer failure → treat as rejection
        verdicts.push({
          accepted: false,
          reviewerIndex: i,
          reasoning: `Reviewer error: ${String(err)}`,
        });
      }
    }

    return verdicts;
  }

  private evaluateConsensus(verdicts: ReviewVerdict[]): boolean {
    const accepted = verdicts.filter((v) => v.accepted).length;

    switch (this.config.mode) {
      case 'majority_vote':
        return accepted > verdicts.length / 2;
      case 'unanimous':
        return accepted === verdicts.length;
      case 'threshold':
        return accepted / verdicts.length >= this.config.thresholdRatio;
    }
  }

  private buildSummary(verdicts: ReviewVerdict[]): string {
    const accepted = verdicts.filter((v) => v.accepted).length;
    const rejected = verdicts.length - accepted;

    const reasons = verdicts
      .filter((v) => !v.accepted)
      .map((v) => `Reviewer ${v.reviewerIndex + 1}: ${v.reasoning}`)
      .join('\n');

    return `${accepted}/${verdicts.length} reviewers accepted. ${rejected} rejected.\n${reasons}`;
  }
}
