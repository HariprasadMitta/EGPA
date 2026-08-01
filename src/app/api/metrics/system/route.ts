import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Real row counts and real service-level rollups across every table in the
// database - the "data sources & endpoints" view. Every number here is a
// live COUNT/aggregate against Neon Postgres at request time, not a cached
// or simulated figure - deliberately dense (every table, every real
// external service this app actually calls), matching the rest of this
// app's "measured, not narrated" bar.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const [
    userCount,
    useCaseCount,
    recommendationCount,
    gateCount,
    adrCount,
    executionCount,
    stepCount,
    toolCallCount,
    webhookTriggerCount,
    riskProfileCount,
    activeKillSwitchCount,
    arbApprovedCount,
    gateAcknowledgedCount,
    enabledWebhookCount,
    webhookTriggerSum,
    lastWebhookRow,
    latestUserRow,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.useCase.count(),
    prisma.recommendation.count(),
    prisma.governanceGate.count(),
    prisma.adr.count(),
    prisma.executionRun.count(),
    prisma.subAgentStep.count(),
    prisma.toolCallLog.count(),
    prisma.webhookTrigger.count(),
    prisma.riskComplianceDetails.count(),
    prisma.useCase.count({ where: { killSwitchEngaged: true } }),
    prisma.governanceGate.count({ where: { arbApproved: true } }),
    prisma.governanceGate.count({ where: { acknowledged: true } }),
    prisma.webhookTrigger.count({ where: { enabled: true } }),
    prisma.webhookTrigger.aggregate({ _sum: { triggerCount: true } }),
    prisma.webhookTrigger.findFirst({
      where: { lastTriggeredAt: { not: null } },
      orderBy: { lastTriggeredAt: "desc" },
      select: { lastTriggeredAt: true },
    }),
    prisma.user.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  return Response.json({
    tables: {
      User: userCount,
      UseCase: useCaseCount,
      Recommendation: recommendationCount,
      GovernanceGate: gateCount,
      Adr: adrCount,
      ExecutionRun: executionCount,
      SubAgentStep: stepCount,
      ToolCallLog: toolCallCount,
      WebhookTrigger: webhookTriggerCount,
      RiskComplianceDetails: riskProfileCount,
    },
    governance: {
      gatesAcknowledged: gateAcknowledgedCount,
      gatesTotal: gateCount,
      arbApprovals: arbApprovedCount,
      killSwitchesEngaged: activeKillSwitchCount,
    },
    webhooks: {
      configured: webhookTriggerCount,
      enabled: enabledWebhookCount,
      totalRealTriggers: webhookTriggerSum._sum.triggerCount ?? 0,
      lastTriggeredAt: lastWebhookRow?.lastTriggeredAt?.toISOString() ?? null,
    },
    users: {
      total: userCount,
      mostRecentSignupAt: latestUserRow?.createdAt?.toISOString() ?? null,
    },
  });
}
