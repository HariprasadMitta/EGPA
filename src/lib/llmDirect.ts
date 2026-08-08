import { ChatOpenAI } from "@langchain/openai";
import { estimateCostUsd } from "@/lib/pricing";
import type { AgentGatewayHandle } from "@/lib/agentModel";
import type { GatewayCompletionResult } from "@/lib/litellm";

// Direct-provider path used only when LLM_DIRECT_MODE=true (set on the
// deployed Vercel environment only, never in local .env.local) - the local-
// only LiteLLM Gateway (src/lib/agentModel.ts / litellm.ts) isn't reachable
// from Vercel's servers, so the deployed app calls OpenRouter directly via
// its OpenAI-compatible API, the same way this app worked before the
// Gateway existed. OpenRouter specifically (not the other 3 providers)
// because it's the one this app's own Gateway testing already confirmed as
// reliable - Anthropic's key is separately, already known to be out of
// credits. Real, just a single provider instead of the Gateway's full
// multi-provider fallback chain - an honest simplification for this
// deploy, not hidden from the Guide's AI Gateway explanation.
const DIRECT_BASE_URL = "https://openrouter.ai/api/v1";

function requireOpenRouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("LLM_DIRECT_MODE requires OPENROUTER_API_KEY to be set.");
  return key;
}

function directModelName(): string {
  return process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct";
}

export function buildDirectAgentModel(): AgentGatewayHandle {
  const label = `openrouter/${directModelName()}`;
  const model = new ChatOpenAI({
    apiKey: requireOpenRouterKey(),
    model: directModelName(),
    configuration: { baseURL: DIRECT_BASE_URL },
    streaming: true,
  });
  return { model, getLastModelName: () => label };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function directChatThread(messages: ChatMessage[], maxTokens: number): Promise<GatewayCompletionResult> {
  const modelName = directModelName();
  const res = await fetch(`${DIRECT_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${requireOpenRouterKey()}`,
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!res.ok) throw new Error(`Direct OpenRouter call failed: ${await res.text()}`);

  const data = await res.json();
  const inputTokens = data?.usage?.prompt_tokens ?? 0;
  const outputTokens = data?.usage?.completion_tokens ?? 0;

  return {
    text: data?.choices?.[0]?.message?.content ?? "",
    provider: `openrouter/${modelName}`,
    inputTokens,
    outputTokens,
    costUsd: estimateCostUsd(modelName, inputTokens, outputTokens),
  };
}

export async function directChatCompletion(system: string, user: string, maxTokens: number): Promise<GatewayCompletionResult> {
  return directChatThread(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens
  );
}
