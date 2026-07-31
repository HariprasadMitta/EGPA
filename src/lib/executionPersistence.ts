import { prisma } from "@/lib/prisma";
import { toExecutionRun } from "@/lib/dbMapping";
import { broadcastBundle } from "@/lib/broadcastBundle";
import { isGateEligible } from "@/lib/governance";
import { ExecutionRun, SubAgentStepStatus } from "@/types";

export interface StartExecutionInput {
  executionId: string;
  runNumber: number;
  masterAgentSummary: string;
  steps: { id: string; name: string; tool: string; task: string }[];
}

export type StartExecutionResult =
  | { ok: true; execution: ExecutionRun }
  | { ok: false; status: number; error: string };

// Shared by the human-driven POST .../executions route and the webhook
// trigger route so a run started either way is created under identical
// governance enforcement (kill-switch, gate clearance, tool allowlist) -
// not a reimplementation that could drift or under-enforce.
export async function startExecutionRun(
  useCaseId: string,
  input: StartExecutionInput
): Promise<StartExecutionResult> {
  const useCase = await prisma.useCase.findUnique({
    where: { id: useCaseId },
    include: { gate: true, recommendation: true },
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

  await prisma.executionRun.create({
    data: {
      id: input.executionId,
      runNumber: input.runNumber,
      useCaseId,
      masterAgentSummary: input.masterAgentSummary,
      status: "running",
      steps: {
        create: input.steps.map((s) => ({
          stepId: s.id,
          name: s.name,
          tool: s.tool,
          task: s.task,
          status: "pending",
        })),
      },
    },
  });
  await prisma.useCase.update({ where: { id: useCaseId }, data: { status: "executing" } });

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
  await prisma.subAgentStep.update({
    where: { executionRunId_stepId: { executionRunId: executionId, stepId } },
    data: patch,
  });

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

  if (allSettled) {
    await prisma.useCase.update({ where: { id: useCaseId }, data: { status: "executed" } });
  }

  const updated = await prisma.executionRun.findUniqueOrThrow({
    where: { id: executionId },
    include: { steps: true, toolCallLogs: true },
  });

  await broadcastBundle(useCaseId);

  return toExecutionRun(updated);
}
