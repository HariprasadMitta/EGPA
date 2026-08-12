import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publishFlowActivity } from "@/lib/eventBus";
import { RiskTier } from "@/types";

export const runtime = "nodejs";

const RISK_TIERS: RiskTier[] = ["Low", "Medium", "High", "Critical"];

// Real, admin-declared baseline manual-process time (and optional cost)
// per risk tier - used to compute real time/cost saved on use cases that
// clear the governance gate. Admin-only to set, same discipline as every
// other org-wide setting (NotificationChannel, Budget). Always an honest,
// declared assumption, never presented as a measured fact - the UI that
// reads this must say so.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const rows = await prisma.governanceBaseline.findMany();
  const byTier = new Map(rows.map((r) => [r.riskTier, r]));

  return Response.json({
    baselines: RISK_TIERS.map((tier) => {
      const row = byTier.get(tier);
      return {
        riskTier: tier,
        baselineHours: row?.baselineHours ?? null,
        costPerHourUsd: row?.costPerHourUsd ?? null,
        updatedAt: row?.updatedAt.toISOString() ?? null,
        updatedByName: row?.updatedByName ?? null,
      };
    }),
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can set governance baselines." }, { status: 403 });
  }

  let body: { riskTier?: string; baselineHours?: number; costPerHourUsd?: number | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const riskTier = body.riskTier;
  if (!riskTier || !RISK_TIERS.includes(riskTier as RiskTier)) {
    return Response.json({ error: "riskTier must be one of Low, Medium, High, Critical." }, { status: 400 });
  }
  if (typeof body.baselineHours !== "number" || body.baselineHours <= 0) {
    return Response.json({ error: "baselineHours must be a positive number." }, { status: 400 });
  }
  if (body.costPerHourUsd != null && (typeof body.costPerHourUsd !== "number" || body.costPerHourUsd < 0)) {
    return Response.json({ error: "costPerHourUsd must be a non-negative number." }, { status: 400 });
  }
  publishFlowActivity("admin");

  const row = await prisma.governanceBaseline.upsert({
    where: { riskTier },
    update: { baselineHours: body.baselineHours, costPerHourUsd: body.costPerHourUsd ?? null, updatedByName: session.user.name },
    create: { riskTier, baselineHours: body.baselineHours, costPerHourUsd: body.costPerHourUsd ?? null, updatedByName: session.user.name },
  });

  return Response.json({
    riskTier: row.riskTier,
    baselineHours: row.baselineHours,
    costPerHourUsd: row.costPerHourUsd,
    updatedAt: row.updatedAt.toISOString(),
    updatedByName: row.updatedByName,
  });
}
