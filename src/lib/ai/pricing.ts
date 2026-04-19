/**
 * Per-provider token pricing in INR per 1k tokens. Matches P5 spec §3.2.
 * Update here when Anthropic/OpenAI pricing changes.
 */

interface ModelPricing {
  inputInrPer1k: number;
  outputInrPer1k: number;
}

const PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-6': { inputInrPer1k: 0.8, outputInrPer1k: 3.2 },
  'claude-haiku-4-5': { inputInrPer1k: 0.08, outputInrPer1k: 0.32 },
  'text-embedding-3-small': { inputInrPer1k: 0.01, outputInrPer1k: 0 },
};

export function estimateCostInr(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model];
  if (!p) return 0;
  const cost = (inputTokens / 1000) * p.inputInrPer1k + (outputTokens / 1000) * p.outputInrPer1k;
  return Math.round(cost * 10_000) / 10_000;
}
