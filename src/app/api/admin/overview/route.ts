import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Real org-wide at-a-glance rollup for Admin, distinct from the existing
// /admin console (real config/actions - notifications, budgets, retention)
// and /governance (posture aimed at governance-owner/ARB/admin, gated
// controls and delegation). This one is Admin-only and answers "what's
// actually happening across the platform right now" - use case volume by
// status/risk tier, org-wide spend and execution counts, headcount by role,
// and the most recent real governance actions across every use case, not
// just one at a time.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can see the overview dashboard." }, { status: 403 });
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });
  const orgScope = me?.organizationId
    ? { OR: [{ organizationId: me.organizationId }, { organizationId: null }] }
    : undefined;

  const [useCases, users, executionAgg, recentActivity] = await Promise.all([
    prisma.useCase.findMany({
      where: orgScope,
      select: { status: true, riskTier: true, killSwitchEngaged: true },
    }),
    prisma.user.findMany({
      where: orgScope,
      select: { role: true },
    }),
    prisma.executionRun.aggregate({
      where: orgScope ? { useCase: orgScope } : undefined,
      _count: { _all: true },
      _sum: { totalCostUsd: true, totalInputTokens: true, totalOutputTokens: true },
    }),
    prisma.auditLogEntry.findMany({
      where: orgScope ? { useCase: orgScope } : undefined,
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        action: true,
        detail: true,
        actorName: true,
        createdAt: true,
        useCase: { select: { id: true, title: true } },
      },
    }),
  ]);

  function countBy<T extends string>(rows: { [k: string]: unknown }[], key: string): { label: string; value: number }[] {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const k = String(r[key]) as T;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([label, value]) => ({ label, value }));
  }

  return Response.json({
    totalUseCases: useCases.length,
    killSwitchEngagedCount: useCases.filter((u) => u.killSwitchEngaged).length,
    useCasesByStatus: countBy(useCases, "status"),
    useCasesByRiskTier: countBy(useCases, "riskTier"),
    usersByRole: countBy(users, "role"),
    totalUsers: users.length,
    totalExecutions: executionAgg._count._all,
    totalCostUsd: executionAgg._sum.totalCostUsd ?? 0,
    totalInputTokens: executionAgg._sum.totalInputTokens ?? 0,
    totalOutputTokens: executionAgg._sum.totalOutputTokens ?? 0,
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      action: a.action,
      detail: a.detail,
      actorName: a.actorName,
      useCaseId: a.useCase.id,
      useCaseTitle: a.useCase.title,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}
