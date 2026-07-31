import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toExecutionRun } from "@/lib/dbMapping";
import { broadcastBundle } from "@/lib/broadcastBundle";
import { SubAgentStepStatus } from "@/types";

export const runtime = "nodejs";

interface StepPatchBody {
  status?: SubAgentStepStatus;
  output?: string | null;
  provider?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  durationMs?: number;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; executionId: string; stepId: string }> }
) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id: useCaseId, executionId, stepId } = await params;

  const useCase = await prisma.useCase.findUnique({ where: { id: useCaseId } });
  if (!useCase) return Response.json({ error: "Use case not found." }, { status: 404 });
  if (useCase.killSwitchEngaged) {
    return Response.json(
      { error: "Kill switch is engaged for this use case - execution is blocked." },
      { status: 403 }
    );
  }

  let body: StepPatchBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  await prisma.subAgentStep.update({
    where: { executionRunId_stepId: { executionRunId: executionId, stepId } },
    data: body,
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

  return Response.json({ execution: toExecutionRun(updated) });
}
