import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canSeeAllUseCases } from "@/lib/roles";
import { GOVERNANCE_TEMPLATES } from "@/lib/governance";
import { RiskTier, UserRole } from "@/types";

export const runtime = "nodejs";

function monthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// Real org-wide governance rollup - the one screen an actual compliance
// owner wants and didn't have: every number here is computed from the same
// tables the per-use-case pages already show, just aggregated instead of
// read one use case at a time. Gated the same as "who can see across
// business units" (governance-owner/arb/admin) since this is portfolio-wide
// oversight, not a single team's view.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!canSeeAllUseCases(session.user.role as UserRole)) {
    return Response.json({ error: "Only governance-owner, ARB, or admin can see the portfolio-wide posture." }, { status: 403 });
  }

  const since = monthStart();

  const [criticalGates, allGates, piiCount, anomalyCount, budgets] = await Promise.all([
    prisma.governanceGate.findMany({ where: { riskTier: "Critical" }, select: { arbApproved: true } }),
    prisma.governanceGate.findMany({
      select: { useCaseId: true, riskTier: true, acknowledgedAt: true },
    }),
    prisma.subAgentStep.count({
      where: { piiDetected: true, executionRun: { startedAt: { gte: since } } },
    }),
    prisma.auditLogEntry.count({
      where: { action: { in: ["drift_detected", "anomaly_detected"] }, createdAt: { gte: since } },
    }),
    prisma.budget.findMany(),
  ]);

  const criticalTotal = criticalGates.length;
  const criticalApproved = criticalGates.filter((g) => g.arbApproved).length;

  const now = Date.now();
  let recertificationOverdue = 0;
  for (const gate of allGates) {
    const template = GOVERNANCE_TEMPLATES[gate.riskTier as RiskTier];
    if (!template?.recertificationDays || !gate.acknowledgedAt) continue;
    const dueAt = gate.acknowledgedAt.getTime() + template.recertificationDays * 24 * 60 * 60 * 1000;
    if (dueAt < now) recertificationOverdue += 1;
  }

  let budgetAlerts = 0;
  for (const budget of budgets) {
    const scope = budget.useCaseId ? { useCaseId: budget.useCaseId } : { businessDomain: budget.businessDomain! };
    const since2 = monthStart();
    const spentUsd = budget.useCaseId
      ? (
          await prisma.executionRun.aggregate({
            where: { useCaseId: budget.useCaseId, startedAt: { gte: since2 } },
            _sum: { totalCostUsd: true },
          })
        )._sum.totalCostUsd ?? 0
      : (
          await prisma.executionRun.aggregate({
            where: { useCase: { businessDomain: (scope as { businessDomain: string }).businessDomain }, startedAt: { gte: since2 } },
            _sum: { totalCostUsd: true },
          })
        )._sum.totalCostUsd ?? 0;
    const percentUsed = (spentUsd / budget.monthlyLimitUsd) * 100;
    if (percentUsed >= budget.alertThresholdPct) budgetAlerts += 1;
  }

  return Response.json({
    criticalArbApproval: { total: criticalTotal, approved: criticalApproved },
    recertificationOverdue,
    piiRedactionsThisMonth: piiCount,
    anomaliesThisMonth: anomalyCount,
    budgetAlertsActive: budgetAlerts,
    totalUseCasesTracked: allGates.length,
  });
}
