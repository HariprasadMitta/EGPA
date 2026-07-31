import { classifyRisk } from "@/lib/governance";
import { callWithFallback, resolveProviderChain } from "@/lib/llmProviders";
import { clientIp, createRateLimiter } from "@/lib/rateLimit";
import { AutonomyLevel, DataSensitivity, IntegrationSurface } from "@/types";

export const runtime = "nodejs";

const MAX_REQUESTS_PER_IP_PER_HOUR = 5;
const MAX_TOTAL_REQUESTS_PER_HOUR = 60;
const limiter = createRateLimiter(MAX_REQUESTS_PER_IP_PER_HOUR, MAX_TOTAL_REQUESTS_PER_HOUR);

interface RecommendRequestBody {
  title: string;
  description: string;
  businessDomain: string;
  dataSensitivity: DataSensitivity;
  autonomyLevel: AutonomyLevel;
  integrationSurface: IntegrationSurface;
  expectedUsers: string;
}

interface RecommendationPayload {
  framework: string;
  tools: string[];
  harnessPattern: string;
  loopPattern: string;
  iterationCeiling: number;
  contextStrategy: string;
  rationale: string;
}

function buildSystemPrompt(): string {
  return `You are the recommendation engine inside an enterprise AI governance advisor.
Given a use case description, questionnaire answers, and a computed risk tier,
recommend a concrete agent architecture. Respond with ONLY a JSON object
(no markdown fences, no prose outside the JSON) matching exactly this shape:

{
  "framework": string (a specific agent framework or tool stack, e.g. "LangGraph", "AutoGen", "Bedrock Agents", "Custom orchestrator on the Claude Agent SDK"),
  "tools": string[] (3-6 concrete tools/integrations this use case would need),
  "harnessPattern": string (one short label, e.g. "Single-agent with tool-calling loop", "Supervisor + worker sub-agents"),
  "loopPattern": string (one short label describing the control loop, e.g. "ReAct with reflection step"),
  "iterationCeiling": number (a sane max loop iterations for this risk tier - lower for higher risk),
  "contextStrategy": string (one short label, e.g. "Sliding window with tool-result summarization", "Full context, no compaction needed"),
  "rationale": string (2-4 sentences explaining the choices above, referencing the risk tier and use case specifics)
}

Higher risk tiers should get tighter iteration ceilings, more conservative
harness patterns (favor human-in-the-loop-friendly patterns), and more
constrained tool access. Be specific and concrete, not generic.

Where a tool would realistically be exposed to the agent via an MCP (Model
Context Protocol) server rather than a bespoke API integration, name it that
way (e.g. "GitHub MCP server", "Internal Data Platform MCP server") - MCP is
a first-class integration option here, not a fallback.`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  return JSON.parse(candidate);
}

function isValidRecommendation(value: unknown): value is RecommendationPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.framework === "string" &&
    Array.isArray(v.tools) &&
    v.tools.every((t) => typeof t === "string") &&
    typeof v.harnessPattern === "string" &&
    typeof v.loopPattern === "string" &&
    typeof v.iterationCeiling === "number" &&
    typeof v.contextStrategy === "string" &&
    typeof v.rationale === "string"
  );
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const gate = limiter.check(ip);
  if (!gate.allowed) {
    return Response.json({ error: gate.reason, remaining: 0 }, { status: 429 });
  }

  let body: RecommendRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.description || !body.dataSensitivity || !body.autonomyLevel || !body.integrationSurface) {
    return Response.json({ error: "Missing required fields." }, { status: 400 });
  }

  const riskTier = classifyRisk({
    dataSensitivity: body.dataSensitivity,
    autonomyLevel: body.autonomyLevel,
    integrationSurface: body.integrationSurface,
  });

  if (resolveProviderChain().length === 0) {
    return Response.json(
      {
        error:
          "No LLM provider is configured on the server. Add at least one of ANTHROPIC_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY, GEMINI_API_KEY to .env.local (see .env.local.example) and restart the dev server.",
      },
      { status: 500 }
    );
  }

  const userMessage = `Use case title: ${body.title}
Business domain: ${body.businessDomain}
Data sensitivity: ${body.dataSensitivity}
Agent autonomy level: ${body.autonomyLevel}
Integration surface: ${body.integrationSurface}
Expected users: ${body.expectedUsers}
Computed risk tier: ${riskTier}

Free-text use case description:
${body.description}`;

  try {
    const { provider, text } = await callWithFallback(buildSystemPrompt(), userMessage, 1024);
    const parsed = extractJson(text);

    if (!isValidRecommendation(parsed)) {
      return Response.json(
        { error: `Recommendation engine (${provider}) returned an unexpected shape.` },
        { status: 502 }
      );
    }

    limiter.record(ip);

    return Response.json({
      riskTier,
      recommendation: parsed,
      provider,
      remaining: gate.remaining - 1,
    });
  } catch (err) {
    return Response.json(
      { error: `Recommendation engine error: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
