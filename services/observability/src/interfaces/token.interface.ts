export interface CostReport {
  period: string;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
  breakdown: CostBreakdown[];
}

export interface CostBreakdown {
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}
