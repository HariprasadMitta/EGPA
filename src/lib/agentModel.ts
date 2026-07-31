import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";

export type AgentProvider = "anthropic" | "openrouter";

function hasKey(provider: AgentProvider): boolean {
  return provider === "anthropic"
    ? Boolean(process.env.ANTHROPIC_API_KEY)
    : Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * Resolves which of the two tool-calling-capable providers to use for this
 * request. Deliberately not a live try-then-fallback across a stream (a
 * failure partway through a streamed response can't be gaplessly retried
 * without either duplicating already-sent tokens or buffering server-side
 * first, which would defeat the point of streaming) - if the resolved
 * provider's stream fails mid-response, the step surfaces that as an error
 * exactly like the rest of this app's step-execution error handling.
 */
export function resolveAgentProvider(): AgentProvider {
  const primary: AgentProvider = process.env.LLM_PROVIDER === "openrouter" ? "openrouter" : "anthropic";
  if (hasKey(primary)) return primary;
  const other: AgentProvider = primary === "anthropic" ? "openrouter" : "anthropic";
  if (hasKey(other)) return other;
  throw new Error(
    "No LLM provider configured for tool-calling execution. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY."
  );
}

export function buildAgentModel(provider: AgentProvider): ChatAnthropic | ChatOpenAI {
  if (provider === "anthropic") {
    return new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
      streaming: true,
    });
  }
  return new ChatOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct",
    configuration: { baseURL: "https://openrouter.ai/api/v1" },
    streaming: true,
  });
}
