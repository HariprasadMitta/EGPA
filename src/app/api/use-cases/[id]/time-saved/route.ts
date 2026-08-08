import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeTimeSaved } from "@/lib/timeSaved";

export const runtime = "nodejs";

// Real time (and, if the admin declared a cost/hour, real cost) saved for
// one use case - Intake submission to Governance Gate clearing, compared
// against the admin-declared baseline for its risk tier. Returns
// { available: false } rather than fabricating a number when the gate
// hasn't cleared yet or no baseline has been set.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const useCase = await prisma.useCase.findUnique({
    where: { id },
    select: { createdAt: true, riskTier: true, gate: { select: { acknowledgedAt: true } } },
  });
  if (!useCase) return Response.json({ error: "Use case not found." }, { status: 404 });

  const baseline = await prisma.governanceBaseline.findUnique({ where: { riskTier: useCase.riskTier } });

  const result = computeTimeSaved({
    createdAt: useCase.createdAt,
    acknowledgedAt: useCase.gate?.acknowledgedAt ?? null,
    baselineHours: baseline?.baselineHours ?? null,
    costPerHourUsd: baseline?.costPerHourUsd ?? null,
  });

  if (!result) return Response.json({ available: false });

  return Response.json({ available: true, ...result });
}
