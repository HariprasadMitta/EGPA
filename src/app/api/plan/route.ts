import { callWithFallback, resolveProviderChain } from "@/lib/llmProviders";
import { estimateCostUsd } from "@/lib/pricing";
import { clientIp } from "@/lib/rateLimit";
import { executionLimiter, MAX_STEPS } from "@/lib/executionLimiter";

export const runtime = "nodejs";

interface PlanRequestBody {
  title: string;
  description: string;
  riskTier: string;
  framework: string;
  tools: string[];
  harnessPattern: string;
}

interface PlanStepPayload {
  name: string;
  tool: string;
  task: string;
}

interface PlanPayload {
  masterAgentSummary: string;
  steps: PlanStepPayload[];
}

function buildSystemPrompt(tools: string[], maxSteps: number): string {
  return `You are the master agent in a multi-agent execution system. Break the
approved recommendation into ${Math.min(2, maxSteps)}-${maxSteps} concrete sub-agent
steps. Each step's "tool" field must be one of these available tools: ${tools.join(", ")}.

Respond with ONLY a JSON object (no markdown fences, no prose) matching exactly:
{
  "masterAgentSummary": string (one sentence describing your plan),
  "steps": [{ "name": string (short sub-agent name), "tool": string (one of the available tools), "task": string (one sentence, concrete and specific to this use case) }]
}`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function isValidPlan(value: unknown): value is PlanPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.masterAgentSummary === "string" &&
    Array.isArray(v.steps) &&
    v.steps.length > 0 &&
    v.steps.every(
      (s) =>
        s &&
        typeof s === "object" &&
        typeof (s as PlanStepPayload).name === "string" &&
        typeof (s as PlanStepPayload).tool === "string" &&
        typeof (s as PlanStepPayload).task === "string"
    )
  );
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const gate = executionLimiter.check(ip);
  if (!gate.allowed) {
    return Response.json({ error: gate.reason }, { status: 429 });
  }

  if (resolveProviderChain().length === 0) {
    return Response.json(
      { error: "No LLM provider is configured on the server." },
      { status: 500 }
    );
  }

  let body: PlanRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.title || !Array.isArray(body.tools) || body.tools.length === 0) {
    return Response.json({ error: "Missing required fields." }, { status: 400 });
  }

  const userMessage = `Use case: ${body.title}
Risk tier: ${body.riskTier}
Framework: ${body.framework}
Harness pattern: ${body.harnessPattern}
Available tools: ${body.tools.join(", ")}

Description:
${body.description}`;

  const start = Date.now();
  try {
    const { provider, text, inputTokens, outputTokens } = await callWithFallback(
      buildSystemPrompt(body.tools, MAX_STEPS),
      userMessage,
      500
    );
    const parsed = extractJson(text);

    if (!isValidPlan(parsed)) {
      return Response.json(
        { error: `Master agent (${provider}) returned an unexpected shape.` },
        { status: 502 }
      );
    }

    executionLimiter.record(ip);

    return Response.json({
      masterAgentSummary: parsed.masterAgentSummary,
      steps: parsed.steps.slice(0, MAX_STEPS),
      provider,
      inputTokens,
      outputTokens,
      costUsd: estimateCostUsd(provider, inputTokens, outputTokens),
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return Response.json(
      { error: `Master agent planning error: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
