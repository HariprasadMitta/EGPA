import { callWithFallback, resolveProviderChain } from "@/lib/llmProviders";
import { estimateCostUsd } from "@/lib/pricing";
import { clientIp } from "@/lib/rateLimit";
import { executionLimiter } from "@/lib/executionLimiter";

export const runtime = "nodejs";

interface ExecuteStepRequestBody {
  useCaseTitle: string;
  useCaseDescription: string;
  masterAgentSummary: string;
  step: { name: string; tool: string; task: string };
}

function buildSystemPrompt(step: ExecuteStepRequestBody["step"]): string {
  return `You are the sub-agent "${step.name}", responsible for the tool "${step.tool}"
within a larger multi-agent execution. Carry out your assigned task and report
back to the master agent in 2-4 concise sentences: what you did and what you
found or produced. Be specific and concrete for this use case, not generic.
Plain text only - no JSON, no markdown, no preamble like "As the sub-agent...".`;
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

  let body: ExecuteStepRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.step?.name || !body.step?.tool || !body.step?.task) {
    return Response.json({ error: "Missing required fields." }, { status: 400 });
  }

  const userMessage = `Use case: ${body.useCaseTitle}
Description: ${body.useCaseDescription}
Master agent's plan: ${body.masterAgentSummary}

Your task: ${body.step.task}`;

  const start = Date.now();
  try {
    const { provider, text, inputTokens, outputTokens } = await callWithFallback(
      buildSystemPrompt(body.step),
      userMessage,
      250
    );

    executionLimiter.record(ip);

    return Response.json({
      output: text.trim(),
      provider,
      inputTokens,
      outputTokens,
      costUsd: estimateCostUsd(provider, inputTokens, outputTokens),
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return Response.json(
      { error: `Sub-agent execution error: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
