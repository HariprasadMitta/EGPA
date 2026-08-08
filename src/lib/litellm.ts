// Real AI Gateway (LiteLLM Proxy, Phase 10) - the non-LangChain path, used
// by /api/recommend (a one-shot JSON call, no tool-calling/streaming
// needed). Unlike src/lib/agentModel.ts's LangChain-mediated path, a plain
// fetch here gets the gateway's real response body/headers directly - so
// this reads LiteLLM's real per-request cost and provider attribution
// straight off the response instead of falling back to an estimate.
import { estimateCostUsd } from "@/lib/pricing";
import { directChatThread, type ChatMessage } from "@/lib/llmDirect";

export type { ChatMessage };

export interface GatewayCompletionResult {
  text: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

// Multi-turn variant - takes the full message history so callers (the
// Discovery Advisor's chat, in particular) can carry conversation context
// across turns instead of being limited to one system + one user message.
export async function gatewayChatThread(messages: ChatMessage[], maxTokens: number): Promise<GatewayCompletionResult> {
  // Same emergency-only escape hatch as src/lib/agentModel.ts - see there.
  if (process.env.LLM_DIRECT_MODE === "true") {
    return directChatThread(messages, maxTokens);
  }

  if (!process.env.LITELLM_BASE_URL || !process.env.LITELLM_VIRTUAL_KEY) {
    throw new Error(
      "AI Gateway not configured. Set LITELLM_BASE_URL and LITELLM_VIRTUAL_KEY (see litellm-config.yaml)."
    );
  }

  const res = await fetch(`${process.env.LITELLM_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.LITELLM_VIRTUAL_KEY}`,
    },
    body: JSON.stringify({
      model: "egpa-primary",
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!res.ok) throw new Error(`AI Gateway call failed: ${await res.text()}`);

  const data = await res.json();
  const modelName = res.headers.get("x-litellm-model-name") ?? "egpa-primary";
  const inputTokens = data?.usage?.prompt_tokens ?? 0;
  const outputTokens = data?.usage?.completion_tokens ?? 0;
  const realCost = data?.usage?.cost;

  return {
    text: data?.choices?.[0]?.message?.content ?? "",
    provider: modelName,
    inputTokens,
    outputTokens,
    costUsd: typeof realCost === "number" ? realCost : estimateCostUsd(modelName, inputTokens, outputTokens),
  };
}

export async function gatewayChatCompletion(system: string, user: string, maxTokens: number): Promise<GatewayCompletionResult> {
  return gatewayChatThread(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens
  );
}
