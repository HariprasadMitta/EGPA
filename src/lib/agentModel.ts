import { ChatOpenAI } from "@langchain/openai";
import { buildDirectAgentModel } from "@/lib/llmDirect";

// Real AI Gateway (LiteLLM Proxy, Phase 10, local-only for now - see
// litellm-config.yaml). The app no longer picks a provider or holds a raw
// provider key: it always talks to one gateway endpoint with one scoped
// virtual key, and the gateway's own model_list/fallbacks config
// (momentum-primary -> anthropic -> groq -> gemini) does what
// resolveAgentProvider()'s branching used to do in app code.
//
// Real provider attribution: LiteLLM returns which upstream model actually
// served the request via the `x-litellm-model-name` response header (e.g.
// "openrouter/meta-llama/llama-3.3-70b-instruct") - confirmed empirically
// present on both streaming and non-streaming responses, unlike the JSON
// body's `model` field (which LiteLLM overwrites with the requested alias,
// a known upstream behavior). LangChain's ChatOpenAI doesn't surface raw
// response headers itself, so a custom `fetch` captures it directly - this
// is what keeps the Dashboard's "provider mix" stat real instead of a
// constant "momentum-primary" for every step.
export interface AgentGatewayHandle {
  model: ChatOpenAI;
  getLastModelName: () => string | null;
}

export function buildAgentModel(): AgentGatewayHandle {
  // Emergency-only escape hatch (LLM_DIRECT_MODE=true) - the real Gateway
  // is hosted for real (render.yaml) and used by default; this exists so a
  // problem with that free-tier host doesn't take the whole app down with
  // it. Never set locally - local dev always goes through the real Gateway.
  if (process.env.LLM_DIRECT_MODE === "true") {
    return buildDirectAgentModel();
  }

  if (!process.env.LITELLM_BASE_URL || !process.env.LITELLM_VIRTUAL_KEY) {
    throw new Error(
      "AI Gateway not configured. Set LITELLM_BASE_URL and LITELLM_VIRTUAL_KEY (see litellm-config.yaml)."
    );
  }

  let lastModelName: string | null = null;

  const model = new ChatOpenAI({
    apiKey: process.env.LITELLM_VIRTUAL_KEY,
    model: "momentum-primary",
    configuration: {
      baseURL: process.env.LITELLM_BASE_URL,
      fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
        const res = await fetch(url, init);
        lastModelName = res.headers.get("x-litellm-model-name") ?? lastModelName;
        return res;
      },
    },
    streaming: true,
  });

  return { model, getLastModelName: () => lastModelName };
}
