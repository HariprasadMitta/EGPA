import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canSeeAllUseCases } from "@/lib/roles";
import { computeTimeSaved } from "@/lib/timeSaved";
import type { Prisma } from "@prisma/client";
import { UserRole } from "@/types";

export const runtime = "nodejs";

// Real, org-wide business-value rollup - every number here is computed
// from the same tables the per-use-case pages already show (GovernanceGate,
// SubAgentStep, AuditLogEntry, ExecutionRun), just aggregated. Gated the
// same as governance-posture (portfolio-wide oversight, not a single
// team's view) and org-scoped the same way GET /api/use-cases is.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true, role: true },
  });
  if (!me?.role || !canSeeAllUseCases(me.role as UserRole)) {
    return Response.json({ error: "Only governance-owner, ARB, or admin can see business value." }, { status: 403 });
  }

  const useCaseWhere: Prisma.UseCaseWhereInput = {};
  if (me.organizationId) {
    useCaseWhere.OR = [{ organizationId: me.organizationId }, { organizationId: null }];
  }

  const useCases = await prisma.useCase.findMany({
    where: useCaseWhere,
    select: { id: true, createdAt: true, riskTier: true, gate: { select: { acknowledgedAt: true } } },
  });
  const ids = useCases.map((u) => u.id);

  const [baselines, providerRows, piiDetections, undeclaredToolIncidents, preflightDenials, killSwitchEngagements, executionRuns] =
    await Promise.all([
      prisma.governanceBaseline.findMany(),
      prisma.subAgentStep.findMany({
        where: { provider: { not: null }, executionRun: { dryRun: false, useCaseId: { in: ids } } },
        select: { provider: true, executionRun: { select: { useCaseId: true } } },
      }),
      prisma.subAgentStep.count({
        where: { piiDetected: true, executionRun: { dryRun: false, useCaseId: { in: ids } } },
      }),
      prisma.auditLogEntry.count({ where: { useCaseId: { in: ids }, action: "undeclared_tool_detected" } }),
      prisma.auditLogEntry.count({ where: { useCaseId: { in: ids }, action: "preflight_check_denied" } }),
      prisma.auditLogEntry.count({ where: { useCaseId: { in: ids }, action: "kill_switch_engaged" } }),
      prisma.executionRun.findMany({
        where: { useCaseId: { in: ids }, dryRun: false, status: "completed" },
        select: { useCaseId: true, completedAt: true },
      }),
    ]);

  const baselineByTier = new Map(baselines.map((b) => [b.riskTier, b]));

  let totalHoursSaved = 0;
  let hoursCounted = 0;
  let totalCostSavedUsd = 0;
  let costCounted = 0;
  for (const uc of useCases) {
    const baseline = baselineByTier.get(uc.riskTier);
    const result = computeTimeSaved({
      createdAt: uc.createdAt,
      acknowledgedAt: uc.gate?.acknowledgedAt ?? null,
      baselineHours: baseline?.baselineHours ?? null,
      costPerHourUsd: baseline?.costPerHourUsd ?? null,
    });
    if (!result) continue;
    totalHoursSaved += result.hoursSaved;
    hoursCounted += 1;
    if (result.costSavedUsd != null) {
      totalCostSavedUsd += result.costSavedUsd;
      costCounted += 1;
    }
  }

  const useCaseCountByProvider = new Map<string, Set<string>>();
  for (const row of providerRows) {
    if (!row.provider) continue;
    const set = useCaseCountByProvider.get(row.provider) ?? new Set<string>();
    set.add(row.executionRun.useCaseId);
    useCaseCountByProvider.set(row.provider, set);
  }
  const modelAdoptionEntries = Array.from(useCaseCountByProvider.entries())
    .map(([provider, set]) => ({ provider, useCaseCount: set.size }))
    .sort((a, b) => b.useCaseCount - a.useCaseCount);
  const reusedModelCount = modelAdoptionEntries.filter((e) => e.useCaseCount >= 2).length;

  const earliestCompletionByUseCase = new Map<string, Date>();
  for (const run of executionRuns) {
    if (!run.completedAt) continue;
    const existing = earliestCompletionByUseCase.get(run.useCaseId);
    if (!existing || run.completedAt < existing) earliestCompletionByUseCase.set(run.useCaseId, run.completedAt);
  }
  const createdAtByUseCase = new Map(useCases.map((u) => [u.id, u.createdAt]));
  let totalCycleHours = 0;
  let cycleCounted = 0;
  for (const [useCaseId, completedAt] of earliestCompletionByUseCase) {
    const createdAt = createdAtByUseCase.get(useCaseId);
    if (!createdAt) continue;
    totalCycleHours += Math.max(0, (completedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
    cycleCounted += 1;
  }

  return Response.json({
    timeSaved: { totalHoursSaved, useCasesCounted: hoursCounted },
    costSaved: { totalCostSavedUsd, useCasesCounted: costCounted },
    modelAdoption: { entries: modelAdoptionEntries, reusedModelCount },
    complianceExposureCaught: {
      piiDetections,
      undeclaredToolIncidents,
      preflightDenials,
      killSwitchEngagements,
      total: piiDetections + undeclaredToolIncidents + preflightDenials + killSwitchEngagements,
    },
    cycleTimeToProduction: {
      averageHours: cycleCounted > 0 ? totalCycleHours / cycleCounted : null,
      useCasesCounted: cycleCounted,
    },
    totalUseCasesTracked: useCases.length,
  });
}
