// Rough, approximate USD per 1K tokens for the default model of each
// provider. Not billing-accurate - labeled "estimated" everywhere it's shown.
// Keyed by the provider prefix LiteLLM's real `x-litellm-model-name`
// response header reports (e.g. "openrouter/meta-llama/..." -> "openrouter"),
// see src/lib/agentModel.ts.
const PRICING_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  anthropic: { input: 0.003, output: 0.015 },
  openrouter: { input: 0.00035, output: 0.0004 },
  groq: { input: 0.00059, output: 0.00079 },
  gemini: { input: 0.0000375, output: 0.00015 },
};

const DEFAULT_RATE = PRICING_PER_1K_TOKENS.openrouter;

// modelName is the real gateway-reported value (e.g.
// "openrouter/meta-llama/llama-3.3-70b-instruct") or null if unavailable.
export function estimateCostUsd(modelName: string | null, inputTokens: number, outputTokens: number): number {
  const prefix = modelName?.split("/")[0] ?? "";
  const rate = PRICING_PER_1K_TOKENS[prefix] ?? DEFAULT_RATE;
  return (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output;
}
