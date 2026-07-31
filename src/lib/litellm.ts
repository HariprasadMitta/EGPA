// Real AI Gateway (LiteLLM Proxy, Phase 10) - the non-LangChain path, used
// by /api/recommend (a one-shot JSON call, no tool-calling/streaming
// needed). Unlike src/lib/agentModel.ts's LangChain-mediated path, a plain
// fetch here gets the gateway's real response body/headers directly - so
// this reads LiteLLM's real per-request cost and provider attribution
// straight off the response instead of falling back to an estimate.
import { estimateCostUsd } from "@/lib/pricing";

export interface GatewayCompletionResult {
  text: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export async function gatewayChatCompletion(
  system: string,
  user: string,
  maxTokens: number
): Promise<GatewayCompletionResult> {
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
      model: "momentum-primary",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) throw new Error(`AI Gateway call failed: ${await res.text()}`);

  const data = await res.json();
  const modelName = res.headers.get("x-litellm-model-name") ?? "momentum-primary";
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
