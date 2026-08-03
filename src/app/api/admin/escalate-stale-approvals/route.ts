import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";
import { logAuditEntry } from "@/lib/audit";

export const runtime = "nodejs";

const STALE_AFTER_DAYS = 5;

async function runEscalation(): Promise<{ checked: number; escalated: number }> {
  const pendingGates = await prisma.governanceGate.findMany({
    where: { requiresArbApproval: true, arbApproved: false },
    include: { useCase: { select: { id: true, title: true } } },
  });

  let escalated = 0;
  for (const gate of pendingGates) {
    const earliest = await prisma.auditLogEntry.findFirst({
      where: { useCaseId: gate.useCaseId, action: "arb_approval_needed" },
      orderBy: { createdAt: "asc" },
    });
    if (!earliest) continue;

    const daysPending = Math.floor((Date.now() - earliest.createdAt.getTime()) / (24 * 60 * 60 * 1000));
    if (daysPending < STALE_AFTER_DAYS) continue;

    await sendNotification({
      kind: "stale_approval_escalation",
      useCaseTitle: gate.useCase.title,
      useCaseId: gate.useCaseId,
      daysPending,
    });
    await logAuditEntry({
      useCaseId: gate.useCaseId,
      actorName: "System",
      action: "stale_approval_escalated",
      detail: `Pending ${daysPending} days.`,
    });
    escalated += 1;
  }

  return { checked: pendingGates.length, escalated };
}

// Real daily nag, not a one-time notification: re-escalates every run while
// a Critical-tier use case's ARB approval stays unresolved past
// STALE_AFTER_DAYS, using the real "arb_approval_needed" audit trail
// (see the gate route) as the actual "pending since" timestamp instead of
// an estimate. Runs on a schedule via Vercel Cron (vercel.json) or manually
// from the admin console - same dual-trigger pattern as the retention purge.
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const session = await auth();
    if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
    if (session.user.role !== "admin") {
      return Response.json({ error: "Only Admin can run this manually." }, { status: 403 });
    }
  }

  const result = await runEscalation();
  return Response.json(result);
}

export async function GET(request: Request) {
  return POST(request);
}
