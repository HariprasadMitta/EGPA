import { LLMProvider } from "@/lib/llmProviders";

// Rough, approximate USD per 1K tokens for the default model of each
// provider. Not billing-accurate - labeled "estimated" everywhere it's shown.
const PRICING_PER_1K_TOKENS: Record<LLMProvider, { input: number; output: number }> = {
  anthropic: { input: 0.003, output: 0.015 },
  openrouter: { input: 0.00035, output: 0.0004 },
  groq: { input: 0.00059, output: 0.00079 },
  gemini: { input: 0.0000375, output: 0.00015 },
};

export function estimateCostUsd(
  provider: LLMProvider,
  inputTokens: number,
  outputTokens: number
): number {
  const rate = PRICING_PER_1K_TOKENS[provider];
  return (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output;
}
