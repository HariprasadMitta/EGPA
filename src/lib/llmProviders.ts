export type LLMProvider = "anthropic" | "openrouter" | "groq" | "gemini";

const PROVIDER_ORDER: LLMProvider[] = ["anthropic", "openrouter", "groq", "gemini"];

interface ProviderCallResult {
  provider: LLMProvider;
  text: string;
  inputTokens: number;
  outputTokens: number;
}

interface RawCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

function hasKey(provider: LLMProvider): boolean {
  switch (provider) {
    case "anthropic":
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case "openrouter":
      return Boolean(process.env.OPENROUTER_API_KEY);
    case "groq":
      return Boolean(process.env.GROQ_API_KEY);
    case "gemini":
      return Boolean(process.env.GEMINI_API_KEY);
  }
}

/**
 * Primary provider first (from LLM_PROVIDER, default anthropic), then the
 * rest of PROVIDER_ORDER as fallbacks - skipping any provider with no key
 * configured, and never trying the same provider twice.
 */
export function resolveProviderChain(): LLMProvider[] {
  const primary = (process.env.LLM_PROVIDER as LLMProvider) || "anthropic";
  const ordered = [primary, ...PROVIDER_ORDER.filter((p) => p !== primary)];
  return ordered.filter(hasKey);
}

async function callAnthropic(system: string, user: string, maxTokens: number): Promise<RawCallResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic call failed: ${await res.text()}`);
  const data = await res.json();
  return {
    text: data?.content?.[0]?.text ?? "",
    inputTokens: data?.usage?.input_tokens ?? 0,
    outputTokens: data?.usage?.output_tokens ?? 0,
  };
}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  user: string,
  maxTokens: number
): Promise<RawCallResult> {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${baseUrl} call failed: ${await res.text()}`);
  const data = await res.json();
  return {
    text: data?.choices?.[0]?.message?.content ?? "",
    inputTokens: data?.usage?.prompt_tokens ?? 0,
    outputTokens: data?.usage?.completion_tokens ?? 0,
  };
}

async function callOpenRouter(system: string, user: string, maxTokens: number): Promise<RawCallResult> {
  return callOpenAICompatible(
    "https://openrouter.ai/api/v1/chat/completions",
    process.env.OPENROUTER_API_KEY!,
    process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct",
    system,
    user,
    maxTokens
  );
}

async function callGroq(system: string, user: string, maxTokens: number): Promise<RawCallResult> {
  return callOpenAICompatible(
    "https://api.groq.com/openai/v1/chat/completions",
    process.env.GROQ_API_KEY!,
    process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    system,
    user,
    maxTokens
  );
}

async function callGemini(system: string, user: string, maxTokens: number): Promise<RawCallResult> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini call failed: ${await res.text()}`);
  const data = await res.json();
  return {
    text: data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
    inputTokens: data?.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

async function callProvider(
  provider: LLMProvider,
  system: string,
  user: string,
  maxTokens: number
): Promise<RawCallResult> {
  switch (provider) {
    case "anthropic":
      return callAnthropic(system, user, maxTokens);
    case "openrouter":
      return callOpenRouter(system, user, maxTokens);
    case "groq":
      return callGroq(system, user, maxTokens);
    case "gemini":
      return callGemini(system, user, maxTokens);
  }
}

/**
 * Tries each configured provider in chain order, returning the first
 * successful response. Throws (with all per-provider errors attached) only
 * if every provider in the chain fails. maxTokens defaults small - callers
 * doing a one-shot JSON recommendation pass a larger value explicitly.
 */
export async function callWithFallback(
  system: string,
  user: string,
  maxTokens = 500
): Promise<ProviderCallResult> {
  const chain = resolveProviderChain();
  const errors: string[] = [];

  for (const provider of chain) {
    try {
      const result = await callProvider(provider, system, user, maxTokens);
      if (result.text.trim()) return { provider, ...result };
      errors.push(`${provider}: empty response`);
    } catch (err) {
      errors.push(`${provider}: ${(err as Error).message}`);
    }
  }

  throw new Error(
    chain.length === 0
      ? "No LLM provider is configured. Set at least one of ANTHROPIC_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY, GEMINI_API_KEY in .env.local."
      : `All configured providers failed: ${errors.join(" | ")}`
  );
}
