import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canSeeAllUseCases } from "@/lib/roles";
import { GOVERNANCE_TEMPLATES } from "@/lib/governance";
import { RiskTier, UserRole } from "@/types";

export const runtime = "nodejs";

export interface ActionItem {
  type: "arb_approval_needed" | "recertification_overdue" | "budget_alert" | "own_gate_pending";
  useCaseId: string | null;
  useCaseTitle: string;
  detail: string;
}

function monthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// Real per-role action queue - replaces "know to go check every use case's
// gate page yourself" with one list of what's actually waiting on you.
// Oversight roles (governance-owner/arb/admin) see portfolio-wide items;
// everyone sees their own use cases waiting on their own next action.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const role = session.user.role as UserRole;
  const items: ActionItem[] = [];

  if (canSeeAllUseCases(role)) {
    const criticalPending = await prisma.governanceGate.findMany({
      where: { requiresArbApproval: true, arbApproved: false },
      include: { useCase: { select: { id: true, title: true, ownerUserId: true } } },
    });
    for (const gate of criticalPending) {
      if (gate.useCase.ownerUserId === session.user.id) continue; // they can't approve their own anyway
      items.push({
        type: "arb_approval_needed",
        useCaseId: gate.useCaseId,
        useCaseTitle: gate.useCase.title,
        detail: "Critical-tier use case waiting on ARB sign-off.",
      });
    }

    const allGates = await prisma.governanceGate.findMany({
      include: { useCase: { select: { id: true, title: true } } },
    });
    const now = Date.now();
    for (const gate of allGates) {
      const template = GOVERNANCE_TEMPLATES[gate.riskTier as RiskTier];
      if (!template?.recertificationDays || !gate.acknowledgedAt) continue;
      const dueAt = gate.acknowledgedAt.getTime() + template.recertificationDays * 24 * 60 * 60 * 1000;
      if (dueAt < now) {
        items.push({
          type: "recertification_overdue",
          useCaseId: gate.useCaseId,
          useCaseTitle: gate.useCase.title,
          detail: `Overdue since ${new Date(dueAt).toLocaleDateString("en-US")}.`,
        });
      }
    }

    const budgets = await prisma.budget.findMany();
    const since = monthStart();
    for (const budget of budgets) {
      const spentUsd = budget.useCaseId
        ? (
            await prisma.executionRun.aggregate({
              where: { useCaseId: budget.useCaseId, startedAt: { gte: since } },
              _sum: { totalCostUsd: true },
            })
          )._sum.totalCostUsd ?? 0
        : (
            await prisma.executionRun.aggregate({
              where: { useCase: { businessDomain: budget.businessDomain! }, startedAt: { gte: since } },
              _sum: { totalCostUsd: true },
            })
          )._sum.totalCostUsd ?? 0;
      const percentUsed = (spentUsd / budget.monthlyLimitUsd) * 100;
      if (percentUsed >= budget.alertThresholdPct) {
        items.push({
          type: "budget_alert",
          useCaseId: null,
          useCaseTitle: budget.useCaseId ? budget.useCaseId : `Business domain "${budget.businessDomain}"`,
          detail: `${percentUsed.toFixed(0)}% of $${budget.monthlyLimitUsd.toFixed(2)} monthly budget used.`,
        });
      }
    }
  }

  const ownPending = await prisma.useCase.findMany({
    where: { ownerUserId: session.user.id, status: "recommended" },
    select: { id: true, title: true },
  });
  for (const uc of ownPending) {
    items.push({
      type: "own_gate_pending",
      useCaseId: uc.id,
      useCaseTitle: uc.title,
      detail: "Governance gate hasn't been cleared yet - required controls need acknowledging.",
    });
  }

  return Response.json({ items });
}
