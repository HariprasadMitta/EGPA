import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBudgetStatus } from "@/lib/budget";

export const runtime = "nodejs";

// Real cost budgets/quotas, scoped to a use case or a business domain -
// checked against real cumulative ExecutionRun.totalCostUsd (see
// src/lib/budget.ts), not an estimate. Admin-managed.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const budgets = await prisma.budget.findMany({ orderBy: { createdAt: "desc" } });
  const withStatus = await Promise.all(
    budgets.map(async (b) => ({
      ...b,
      status: await getBudgetStatus(b.useCaseId ? { useCaseId: b.useCaseId } : { businessDomain: b.businessDomain! }),
    }))
  );

  return Response.json({ budgets: withStatus });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can set budgets." }, { status: 403 });
  }

  let body: { useCaseId?: string; businessDomain?: string; monthlyLimitUsd?: number; alertThresholdPct?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if ((!body.useCaseId && !body.businessDomain) || (body.useCaseId && body.businessDomain)) {
    return Response.json({ error: "Set exactly one of useCaseId or businessDomain." }, { status: 400 });
  }
  if (!body.monthlyLimitUsd || body.monthlyLimitUsd <= 0) {
    return Response.json({ error: "monthlyLimitUsd must be a positive number." }, { status: 400 });
  }

  const budget = await prisma.budget.create({
    data: {
      useCaseId: body.useCaseId ?? null,
      businessDomain: body.businessDomain ?? null,
      monthlyLimitUsd: body.monthlyLimitUsd,
      alertThresholdPct: body.alertThresholdPct ?? 80,
    },
  });

  return Response.json({ budget });
}
