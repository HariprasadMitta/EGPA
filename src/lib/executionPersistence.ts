import { prisma } from "@/lib/prisma";
import { toExecutionRun } from "@/lib/dbMapping";
import { broadcastBundle } from "@/lib/broadcastBundle";
import { isGateEligible } from "@/lib/governance";
import { scanAndRedactPii } from "@/lib/piiDetection";
import { computeConfidenceScore } from "@/lib/confidence";
import { checkStepDrift, checkExecutionVolumeAnomaly } from "@/lib/anomalyDetection";
import { checkBudgetsForUseCase } from "@/lib/budget";
import { sendNotification } from "@/lib/notifications";
import { ExecutionRun, SubAgentStepStatus } from "@/types";

export interface StartExecutionInput {
  executionId: string;
  runNumber: number;
  masterAgentSummary: string;
  steps: { id: string; name: string; tool: string; task: string; rationale?: string }[];
  // Real dry-run mode: still makes real LLM calls (real cost, real output),
  // just excluded from anomaly/drift baselines and doesn't flip the use
  // case's own status - lets a developer iterate without it counting as a
  // governed execution.
  dryRun?: boolean;
}

export type StartExecutionResult =
  | { ok: true; execution: ExecutionRun }
  | { ok: false; status: number; error: string };

// Shared by the human-driven POST .../executions route and the webhook
// trigger route so a run started either way is created under identical
// governance enforcement (kill-switch, gate clearance, tool allowlist) -
// not a reimplementation that could drift or under-enforce.
// Real, keyword-based write-action detection - deliberately simple (same
// class of heuristic as src/lib/piiDetection.ts's regex patterns) rather
// than inventing a structured per-tool "can write" metadata system that
// doesn't otherwise exist in this app.
const WRITE_ACTION_KEYWORDS = /\b(write|writes|writing|update|updates|updating|delete|deletes|deleting|create|creates|creating|modify|modifies|modifying|change|changes|changing)\b/i;

export async function startExecutionRun(
  useCaseId: string,
  input: StartExecutionInput
): Promise<StartExecutionResult> {
  const useCase = await prisma.useCase.findUnique({
    where: { id: useCaseId },
    include: { gate: true, recommendation: true, riskComplianceDetails: true },
  });
  if (!useCase) return { ok: false, status: 404, error: "Use case not found." };

  if (useCase.killSwitchEngaged) {
    return {
      ok: false,
      status: 403,
      error: "Kill switch is engaged for this use case - execution is blocked.",
    };
  }

  if (!isGateEligible(useCase.gate)) {
    return {
      ok: false,
      status: 403,
      error:
        "Governance gate is not cleared - execution requires an acknowledged (and ARB-approved, if required) gate.",
    };
  }

  const allowedTools = new Set(useCase.recommendation?.tools ?? []);
  const disallowed = input.steps.filter((s) => !allowedTools.has(s.tool));
  if (disallowed.length > 0) {
    return {
      ok: false,
      status: 400,
      error: `Tool allowlist enforcement: step(s) referenced a tool outside the recommendation's approved tool stack: ${disallowed.map((s) => s.tool).join(", ")}`,
    };
  }

  // Real data-sensitivity-aware restriction: the deeper Intake questionnaire
  // captures whether this agent has real write access to production systems
  // (RiskComplianceDetails.agentWriteAccessProduction). If it was declared
  // "no", a planned step whose own task/tool text reads as a write action is
  // a real contradiction between what was governed and what's about to run -
  // rejected here, not silently allowed.
  if (useCase.riskComplianceDetails && !useCase.riskComplianceDetails.agentWriteAccessProduction) {
    const writeSteps = input.steps.filter(
      (s) => WRITE_ACTION_KEYWORDS.test(s.task) || WRITE_ACTION_KEYWORDS.test(s.tool)
    );
    if (writeSteps.length > 0) {
      return {
        ok: false,
        status: 400,
        error: `Data-sensitivity restriction: this use case declared no production write access, but step(s) read as write actions: ${writeSteps.map((s) => s.name).join(", ")}`,
      };
    }
  }

  await prisma.executionRun.create({
    data: {
      id: input.executionId,
      runNumber: input.runNumber,
      useCaseId,
      masterAgentSummary: input.masterAgentSummary,
      status: "running",
      dryRun: input.dryRun ?? false,
      steps: {
        create: input.steps.map((s) => ({
          stepId: s.id,
          name: s.name,
          tool: s.tool,
          task: s.task,
          rationale: s.rationale ?? null,
          status: "pending",
        })),
      },
    },
  });
  if (!input.dryRun) {
    await prisma.useCase.update({ where: { id: useCaseId }, data: { status: "executing" } });
  }

  const created = await prisma.executionRun.findUniqueOrThrow({
    where: { id: input.executionId },
    include: { steps: true, toolCallLogs: true },
  });

  await broadcastBundle(useCaseId);

  return { ok: true, execution: toExecutionRun(created) };
}

export interface StepPatch {
  status?: SubAgentStepStatus;
  output?: string | null;
  provider?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  durationMs?: number;
}

// Shared by the human-driven PATCH .../steps/[stepId] route and the webhook
// trigger route's background step loop - same aggregate-recompute logic
// either way (totals, run status, use-case status), and the same live
// broadcast so any open browser tab sees a headless run progress in
// real time, identically to a human-driven one.
export async function applyStepPatch(
  useCaseId: string,
  executionId: string,
  stepId: string,
  patch: StepPatch
): Promise<ExecutionRun> {
  const execution = await prisma.executionRun.findUniqueOrThrow({ where: { id: executionId } });

  // Real PII masking + confidence scoring, applied to the actual output
  // text at the moment a step completes - not a one-time checkbox
  // acknowledgment. `output` becomes the already-redacted text; the real
  // unredacted match count is tracked separately.
  const finalPatch: StepPatch & { confidenceScore?: number | null; piiDetected?: boolean; piiMatchCount?: number } = { ...patch };
  if (patch.status === "done" && typeof patch.output === "string") {
    const pii = scanAndRedactPii(patch.output);
    finalPatch.output = pii.redactedText;
    finalPatch.piiDetected = pii.detected;
    finalPatch.piiMatchCount = pii.matchCount;
    finalPatch.confidenceScore = computeConfidenceScore(pii.redactedText);
  }

  await prisma.subAgentStep.update({
    where: { executionRunId_stepId: { executionRunId: executionId, stepId } },
    data: finalPatch,
  });

  if (patch.status === "done" && typeof patch.durationMs === "number" && !execution.dryRun) {
    const step = await prisma.subAgentStep.findUnique({
      where: { executionRunId_stepId: { executionRunId: executionId, stepId } },
      select: { tool: true },
    });
    if (step) await checkStepDrift(useCaseId, executionId, step.tool, patch.durationMs);
  }

  const siblingSteps = await prisma.subAgentStep.findMany({ where: { executionRunId: executionId } });
  const totalInputTokens = siblingSteps.reduce((sum, s) => sum + s.inputTokens, 0);
  const totalOutputTokens = siblingSteps.reduce((sum, s) => sum + s.outputTokens, 0);
  const totalCostUsd = siblingSteps.reduce((sum, s) => sum + s.costUsd, 0);
  const allSettled = siblingSteps.every((s) => s.status === "done" || s.status === "error");
  const anyError = siblingSteps.some((s) => s.status === "error");
  const status = allSettled ? (anyError ? "failed" : "completed") : "running";

  await prisma.executionRun.update({
    where: { id: executionId },
    data: {
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd,
      status,
      completedAt: allSettled ? new Date() : null,
    },
  });

  if (allSettled && !execution.dryRun) {
    const useCase = await prisma.useCase.update({
      where: { id: useCaseId },
      data: { status: "executed" },
      select: { title: true, businessDomain: true },
    });

    await checkBudgetsForUseCase(useCaseId, useCase.businessDomain);
    await checkExecutionVolumeAnomaly(useCaseId, useCase.title);

    if (anyError) {
      const failedStep = siblingSteps.find((s) => s.status === "error");
      await sendNotification({
        kind: "execution_failed",
        useCaseTitle: useCase.title,
        useCaseId,
        error: failedStep?.output ?? "A sub-agent step failed.",
      });
    }
  }

  const updated = await prisma.executionRun.findUniqueOrThrow({
    where: { id: executionId },
    include: { steps: true, toolCallLogs: true },
  });

  await broadcastBundle(useCaseId);

  return toExecutionRun(updated);
}
