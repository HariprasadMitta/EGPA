import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";

export interface BudgetStatus {
  scope: string;
  monthlyLimitUsd: number;
  alertThresholdPct: number;
  spentUsd: number;
  percentUsed: number;
  overThreshold: boolean;
}

function monthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// Real cost-to-date for a use case or a whole business domain this
// calendar month, summed from real ExecutionRun.totalCostUsd rows - not
// an estimate, the same real cost numbers Observability shows.
async function realSpendUsd(scope: { useCaseId: string } | { businessDomain: string }): Promise<number> {
  const since = monthStart();
  if ("useCaseId" in scope) {
    const agg = await prisma.executionRun.aggregate({
      where: { useCaseId: scope.useCaseId, startedAt: { gte: since } },
      _sum: { totalCostUsd: true },
    });
    return agg._sum.totalCostUsd ?? 0;
  }
  const agg = await prisma.executionRun.aggregate({
    where: { useCase: { businessDomain: scope.businessDomain }, startedAt: { gte: since } },
    _sum: { totalCostUsd: true },
  });
  return agg._sum.totalCostUsd ?? 0;
}

// Checked after a real execution completes (see executionPersistence.ts) -
// sends a real Slack alert the first time a budget crosses its threshold
// each check, rather than fabricating a hard block (a demo can't safely
// refuse a governed execution over spend alone without a real finance
// sign-off process behind it, which doesn't exist here).
export async function checkBudgetsForUseCase(useCaseId: string, businessDomain: string): Promise<void> {
  const [useCaseBudget, domainBudget] = await Promise.all([
    prisma.budget.findUnique({ where: { useCaseId } }),
    prisma.budget.findUnique({ where: { businessDomain } }),
  ]);

  for (const budget of [useCaseBudget, domainBudget]) {
    if (!budget) continue;
    const scope = budget.useCaseId ? { useCaseId: budget.useCaseId } : { businessDomain: budget.businessDomain! };
    const spentUsd = await realSpendUsd(scope);
    const percentUsed = (spentUsd / budget.monthlyLimitUsd) * 100;
    if (percentUsed >= budget.alertThresholdPct) {
      await sendNotification({
        kind: "budget_alert",
        scope: budget.useCaseId ? `Use case ${budget.useCaseId}` : `Business domain "${budget.businessDomain}"`,
        spentUsd,
        limitUsd: budget.monthlyLimitUsd,
      });
    }
  }
}

export async function getBudgetStatus(
  scope: { useCaseId: string } | { businessDomain: string }
): Promise<BudgetStatus | null> {
  const budget = "useCaseId" in scope
    ? await prisma.budget.findUnique({ where: { useCaseId: scope.useCaseId } })
    : await prisma.budget.findUnique({ where: { businessDomain: scope.businessDomain } });
  if (!budget) return null;

  const spentUsd = await realSpendUsd(scope);
  const percentUsed = (spentUsd / budget.monthlyLimitUsd) * 100;

  return {
    scope: "useCaseId" in scope ? scope.useCaseId : scope.businessDomain,
    monthlyLimitUsd: budget.monthlyLimitUsd,
    alertThresholdPct: budget.alertThresholdPct,
    spentUsd,
    percentUsed,
    overThreshold: percentUsed >= budget.alertThresholdPct,
  };
}
