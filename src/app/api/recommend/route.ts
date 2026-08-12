import { classifyRisk } from "@/lib/governance";
import { gatewayChatCompletion } from "@/lib/litellm";
import { clientIp, createRateLimiter } from "@/lib/rateLimit";
import { prisma } from "@/lib/prisma";
import { extractJson } from "@/lib/extractJson";
import { publishFlowActivity } from "@/lib/eventBus";
import { AutonomyLevel, DataSensitivity, IntegrationSurface, RiskTier } from "@/types";

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
  alternativesConsidered: string;
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
  "rationale": string (2-4 sentences explaining the choices above, referencing the risk tier and use case specifics),
  "alternativesConsidered": string (2-4 sentences naming 1-2 concrete alternative frameworks/patterns that would also fit this use case, and the specific reason each was passed over in favor of the recommendation above - a real trade-off, not a restatement of the rationale)
}

Higher risk tiers should get tighter iteration ceilings, more conservative
harness patterns (favor human-in-the-loop-friendly patterns), and more
constrained tool access. Be specific and concrete, not generic.

Where a tool would realistically be exposed to the agent via an MCP (Model
Context Protocol) server rather than a bespoke API integration, name it that
way (e.g. "GitHub MCP server", "Internal Data Platform MCP server") - MCP is
a first-class integration option here, not a fallback.`;
}

// Real historical performance summary, not a blind guess: aggregates real
// SubAgentStep rows from past executions on use cases at the same risk
// tier, grouped by provider - gives the recommendation engine (and the
// human reading the rationale) actual data on which providers have
// performed well at this tier, instead of picking without any track record.
async function historicalPerformanceHint(riskTier: RiskTier): Promise<string | null> {
  const steps = await prisma.subAgentStep.findMany({
    where: { status: "done", provider: { not: null }, executionRun: { useCase: { riskTier } } },
    select: { provider: true, durationMs: true, costUsd: true },
    take: 500,
  });
  if (steps.length < 3) return null;

  const byProvider = new Map<string, { count: number; durationSum: number; costSum: number }>();
  for (const s of steps) {
    const key = s.provider!;
    const entry = byProvider.get(key) ?? { count: 0, durationSum: 0, costSum: 0 };
    entry.count += 1;
    entry.durationSum += s.durationMs;
    entry.costSum += s.costUsd;
    byProvider.set(key, entry);
  }

  const lines = [...byProvider.entries()]
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 3)
    .map(([provider, e]) => `- ${provider}: ${e.count} real steps, avg ${(e.durationSum / e.count / 1000).toFixed(1)}s, avg $${(e.costSum / e.count).toFixed(4)}/step`);

  return `Real historical performance at ${riskTier} tier from this platform's own past executions (reference this if it's genuinely relevant, don't force it):\n${lines.join("\n")}`;
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
    typeof v.rationale === "string" &&
    typeof v.alternativesConsidered === "string"
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
  publishFlowActivity("recommendation");

  const riskTier = classifyRisk({
    dataSensitivity: body.dataSensitivity,
    autonomyLevel: body.autonomyLevel,
    integrationSurface: body.integrationSurface,
  });

  const performanceHint = await historicalPerformanceHint(riskTier);

  const userMessage = `Use case title: ${body.title}
Business domain: ${body.businessDomain}
Data sensitivity: ${body.dataSensitivity}
Agent autonomy level: ${body.autonomyLevel}
Integration surface: ${body.integrationSurface}
Expected users: ${body.expectedUsers}
Computed risk tier: ${riskTier}

Free-text use case description:
${body.description}
${performanceHint ? `\n${performanceHint}` : ""}`;

  try {
    const { provider, text } = await gatewayChatCompletion(buildSystemPrompt(), userMessage, 1024);
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
