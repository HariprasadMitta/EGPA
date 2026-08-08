import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface UserConsumption {
  userId: string;
  name: string;
  email: string;
  role: string;
  executionCount: number;
  dryRunExecutionCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  totalProcessingTimeMs: number;
}

// Real per-user resource consumption - tokens, cost, and actual agent
// processing time (sum of real SubAgentStep.durationMs), traced from every
// ExecutionRun back to the UseCase.ownerUserId who submitted it. This is
// NOT session/login time - nothing in this app tracks how long a person is
// actually active in the browser, and fabricating that number would be
// exactly the kind of "presented as measured fact" this platform's own
// conventions (GovernanceBaseline, Time Saved) explicitly avoid elsewhere.
// Dry runs are included (they're still real LLM-backed cost/time) but
// counted separately too, same transparency the rest of the app gives them.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can see per-user consumption." }, { status: 403 });
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });

  const users = await prisma.user.findMany({
    where: me?.organizationId
      ? { OR: [{ organizationId: me.organizationId }, { organizationId: null }] }
      : undefined,
    select: { id: true, name: true, email: true, role: true },
  });

  const executions = await prisma.executionRun.findMany({
    where: { useCase: { ownerUserId: { in: users.map((u) => u.id) } } },
    select: {
      dryRun: true,
      totalInputTokens: true,
      totalOutputTokens: true,
      totalCostUsd: true,
      useCase: { select: { ownerUserId: true } },
      steps: { select: { durationMs: true } },
    },
  });

  const byUser = new Map<string, UserConsumption>();
  for (const u of users) {
    byUser.set(u.id, {
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      executionCount: 0,
      dryRunExecutionCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      totalProcessingTimeMs: 0,
    });
  }

  for (const run of executions) {
    const entry = byUser.get(run.useCase.ownerUserId);
    if (!entry) continue;
    entry.executionCount += 1;
    if (run.dryRun) entry.dryRunExecutionCount += 1;
    entry.totalInputTokens += run.totalInputTokens;
    entry.totalOutputTokens += run.totalOutputTokens;
    entry.totalCostUsd += run.totalCostUsd;
    entry.totalProcessingTimeMs += run.steps.reduce((sum, s) => sum + s.durationMs, 0);
  }

  const rows = Array.from(byUser.values())
    .filter((r) => r.executionCount > 0)
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd);

  return Response.json({ users: rows });
}
