import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/webhookAuth";
import { isGateEligible } from "@/lib/governance";
import { runPlanning } from "@/lib/agentPlan";
import { runStep } from "@/lib/agentStep";
import { startExecutionRun, applyStepPatch } from "@/lib/executionPersistence";
import { triggerLimiter } from "@/lib/executionLimiter";

export const runtime = "nodejs";

function makeExecutionId(): string {
  return `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface StepDraft {
  id: string;
  name: string;
  tool: string;
  task: string;
  rationale: string;
}

// Real event triggering: this is the entry point an external caller (curl, a
// real cron service like cron-job.org, GitHub Actions, anything that can
// send one authenticated HTTP request) hits to start an execution with zero
// human clicking "Run execution." No session/cookie auth - a webhook caller
// has no browser session, so auth is a real bearer token instead (see
// src/lib/webhookAuth.ts). Every governance check the human path enforces
// (kill switch, gate clearance, tool allowlist) runs identically here via
// the shared src/lib/executionPersistence.ts helpers.
export async function POST(request: Request, { params }: { params: Promise<{ useCaseId: string }> }) {
  const { useCaseId } = await params;

  const trigger = await prisma.webhookTrigger.findUnique({ where: { useCaseId } });
  const authHeader = request.headers.get("authorization") ?? "";
  const providedToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!trigger || !providedToken || !verifyToken(providedToken, trigger.tokenHash)) {
    return Response.json({ error: "Invalid or missing webhook token." }, { status: 401 });
  }
  if (!trigger.enabled) {
    return Response.json({ error: "This use case's webhook trigger is disabled." }, { status: 403 });
  }

  const limitGate = triggerLimiter.check(useCaseId);
  if (!limitGate.allowed) {
    return Response.json({ error: limitGate.reason }, { status: 429 });
  }

  const useCase = await prisma.useCase.findUnique({
    where: { id: useCaseId },
    include: { gate: true, recommendation: true },
  });
  if (!useCase) return Response.json({ error: "Use case not found." }, { status: 404 });
  if (useCase.killSwitchEngaged) {
    return Response.json(
      { error: "Kill switch is engaged for this use case - execution is blocked." },
      { status: 403 }
    );
  }
  if (!isGateEligible(useCase.gate)) {
    return Response.json(
      {
        error:
          "Governance gate is not cleared - execution requires an acknowledged (and ARB-approved, if required) gate.",
      },
      { status: 403 }
    );
  }
  if (!useCase.recommendation) {
    return Response.json({ error: "No recommendation exists for this use case yet." }, { status: 400 });
  }

  // Real planning, consumed fully rather than streamed - nobody's watching a
  // headless trigger, so there's no browser to forward tokens to.
  let masterAgentSummary = "";
  const rawSteps: { name: string; tool: string; task: string; rationale: string }[] = [];
  let planError: string | null = null;

  for await (const event of runPlanning({
    title: useCase.title,
    description: useCase.description,
    riskTier: useCase.riskTier,
    framework: useCase.recommendation.framework,
    tools: useCase.recommendation.tools,
    harnessPattern: useCase.recommendation.harnessPattern,
  })) {
    if (event.type === "summary") masterAgentSummary = event.text;
    else if (event.type === "step")
      rawSteps.push({ name: event.name, tool: event.tool, task: event.task, rationale: event.rationale });
    else if (event.type === "error") planError = event.error;
  }

  if (planError || rawSteps.length === 0) {
    return Response.json({ error: planError || "Master agent returned no steps." }, { status: 502 });
  }

  const executionId = makeExecutionId();
  const runNumber = (await prisma.executionRun.count({ where: { useCaseId } })) + 1;
  const steps: StepDraft[] = rawSteps.map((s, i) => ({
    id: `step-${i}`,
    name: s.name,
    tool: s.tool,
    task: s.task,
    rationale: s.rationale,
  }));

  const result = await startExecutionRun(useCaseId, {
    executionId,
    runNumber,
    masterAgentSummary,
    steps,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  triggerLimiter.record(useCaseId);
  await prisma.webhookTrigger.update({
    where: { useCaseId },
    data: { lastTriggeredAt: new Date(), triggerCount: { increment: 1 } },
  });

  // Real fire-and-forget: ack now, keep running the step loop in the
  // background. Every step persists through applyStepPatch, which broadcasts
  // (src/lib/broadcastBundle.ts) after each write - so any open browser tab
  // shows this run appear and progress live with zero refresh, exactly as if
  // a human had clicked "Run execution." This relies on the app running as a
  // persistent Node process (next dev/next start), not a serverless function
  // that freezes after responding - same class of caveat already documented
  // for src/lib/eventBus.ts (per-process, not durable across a restart).
  runStepsInBackground({
    useCaseId,
    executionId,
    masterAgentSummary,
    useCaseTitle: useCase.title,
    useCaseDescription: useCase.description,
    steps,
  }).catch(() => {
    // Best-effort: each step's own outcome is already persisted via
    // applyStepPatch inside the loop below - this only guards against a
    // truly unexpected throw escaping the whole loop.
  });

  return Response.json({ executionId, runNumber, status: "running" }, { status: 202 });
}

async function runStepsInBackground(input: {
  useCaseId: string;
  executionId: string;
  masterAgentSummary: string;
  useCaseTitle: string;
  useCaseDescription: string;
  steps: StepDraft[];
}) {
  const { useCaseId, executionId, masterAgentSummary, useCaseTitle, useCaseDescription, steps } = input;
  const priorSteps: { name: string; output: string }[] = [];

  for (const step of steps) {
    const fresh = await prisma.useCase.findUnique({ where: { id: useCaseId }, select: { killSwitchEngaged: true } });
    if (fresh?.killSwitchEngaged) {
      await applyStepPatch(useCaseId, executionId, step.id, {
        status: "error",
        output: "Kill switch is engaged for this use case - execution is blocked.",
      });
      continue;
    }

    await applyStepPatch(useCaseId, executionId, step.id, { status: "running" });

    let result: {
      output: string;
      provider: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      durationMs: number;
    } | null = null;
    let errorMessage: string | null = null;

    try {
      for await (const event of runStep({
        useCaseTitle,
        useCaseDescription,
        masterAgentSummary,
        executionId,
        stepId: step.id,
        step: { name: step.name, tool: step.tool, task: step.task, rationale: step.rationale },
        priorSteps,
      })) {
        if (event.type === "done") {
          result = {
            output: event.output,
            provider: event.provider,
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
            costUsd: event.costUsd,
            durationMs: event.durationMs,
          };
        } else if (event.type === "error") {
          errorMessage = event.error;
        }
      }
    } catch (err) {
      errorMessage = (err as Error).message;
    }

    if (!result || errorMessage) {
      await applyStepPatch(useCaseId, executionId, step.id, {
        status: "error",
        output: errorMessage || "Sub-agent execution failed.",
      });
      continue;
    }

    await applyStepPatch(useCaseId, executionId, step.id, { status: "done", ...result });
    priorSteps.push({ name: step.name, output: result.output });
  }
}
