import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Real retention enforcement - the deeper Intake questionnaire captures
// real retentionInputsDays/retentionOutputsDays/retentionLogsDays per use
// case (RiskComplianceDetails); this is what actually acts on those
// fields instead of just recording them. Deletes real rows past their
// declared window and logs a real RetentionPurgeLog entry per table per
// use case so the purge itself is auditable, not silent.
async function runRetentionPurge(): Promise<{ useCasesProcessed: number; totalRowsDeleted: number }> {
  const useCases = await prisma.useCase.findMany({
    where: { riskComplianceDetails: { isNot: null } },
    include: { riskComplianceDetails: true },
  });

  let totalRowsDeleted = 0;

  for (const useCase of useCases) {
    const rcd = useCase.riskComplianceDetails!;

    if (rcd.retentionLogsDays) {
      const { count } = await prisma.toolCallLog.deleteMany({
        where: { executionRun: { useCaseId: useCase.id }, createdAt: { lt: daysAgo(rcd.retentionLogsDays) } },
      });
      if (count > 0) {
        await prisma.retentionPurgeLog.create({ data: { useCaseId: useCase.id, tableName: "ToolCallLog", rowsDeleted: count } });
        totalRowsDeleted += count;
      }
    }

    if (rcd.retentionOutputsDays) {
      const { count } = await prisma.subAgentStep.updateMany({
        where: {
          executionRun: { useCaseId: useCase.id, completedAt: { lt: daysAgo(rcd.retentionOutputsDays) } },
          output: { not: null },
        },
        data: { output: "[purged - retention period expired]" },
      });
      if (count > 0) {
        await prisma.retentionPurgeLog.create({ data: { useCaseId: useCase.id, tableName: "SubAgentStep", rowsDeleted: count } });
        totalRowsDeleted += count;
      }
    }

    if (rcd.retentionInputsDays) {
      const { count } = await prisma.executionRun.updateMany({
        where: { useCaseId: useCase.id, completedAt: { lt: daysAgo(rcd.retentionInputsDays) }, masterAgentSummary: { not: "[purged - retention period expired]" } },
        data: { masterAgentSummary: "[purged - retention period expired]" },
      });
      if (count > 0) {
        await prisma.retentionPurgeLog.create({ data: { useCaseId: useCase.id, tableName: "ExecutionRun", rowsDeleted: count } });
        totalRowsDeleted += count;
      }
    }
  }

  return { useCasesProcessed: useCases.length, totalRowsDeleted };
}

// Manual admin trigger.
export async function POST(request: Request) {
  const session = await auth();
  const cronSecret = request.headers.get("authorization")?.replace("Bearer ", "");
  const isCron = Boolean(process.env.CRON_SECRET) && cronSecret === process.env.CRON_SECRET;

  if (!isCron) {
    if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
    if (session.user.role !== "admin") {
      return Response.json({ error: "Only Admin can trigger a retention purge." }, { status: 403 });
    }
  }

  const result = await runRetentionPurge();
  return Response.json(result);
}

// Real scheduled run - see vercel.json's cron entry pointing here with the
// CRON_SECRET bearer token Vercel Cron sends automatically.
export async function GET(request: Request) {
  return POST(request);
}
