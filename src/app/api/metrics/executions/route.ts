import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toExecutionRun } from "@/lib/dbMapping";

export const runtime = "nodejs";

// Every real ExecutionRun across every use case (shared visibility, same as
// Portfolio), newest first - the Observability page's expandable history.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const rows = await prisma.executionRun.findMany({
    include: { steps: true, toolCallLogs: true, useCase: { select: { id: true, title: true, riskTier: true } } },
    orderBy: { startedAt: "desc" },
  });

  const executions = rows.map((row) => ({
    ...toExecutionRun(row),
    useCaseTitle: row.useCase.title,
    riskTier: row.useCase.riskTier,
    toolCallLogs: row.toolCallLogs
      .map((log) => ({
        id: log.id,
        stepId: log.stepId,
        toolName: log.toolName,
        argsJson: log.argsJson,
        result: log.result,
        createdAt: log.createdAt.toISOString(),
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
  }));

  return Response.json({ executions });
}
