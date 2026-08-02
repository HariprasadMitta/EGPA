import { auth } from "@/auth";
import { canApproveArb } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { toGate } from "@/lib/dbMapping";
import { broadcastBundle } from "@/lib/broadcastBundle";
import { logAuditEntry } from "@/lib/audit";
import { sendNotification } from "@/lib/notifications";
import { UserRole } from "@/types";

export const runtime = "nodejs";

type GateActionBody =
  | { action: "toggle"; control: string }
  | { action: "finalize" }
  | { action: "approveArb" };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const gate = await prisma.governanceGate.findUnique({ where: { useCaseId: id } });
  if (!gate) return Response.json({ error: "No governance gate for this use case." }, { status: 404 });

  let body: GateActionBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.action === "toggle") {
    const already = gate.acknowledgedItems.includes(body.control);
    const acknowledgedItems = already
      ? gate.acknowledgedItems.filter((c) => c !== body.control)
      : [...gate.acknowledgedItems, body.control];
    const updated = await prisma.governanceGate.update({
      where: { useCaseId: id },
      data: { acknowledgedItems },
    });
    await logAuditEntry({
      useCaseId: id,
      actorUserId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: already ? "control_unacknowledged" : "control_acknowledged",
      detail: body.control,
    });
    await broadcastBundle(id);
    return Response.json({ gate: toGate(updated) });
  }

  if (body.action === "finalize") {
    const allAcknowledged = gate.requiredControls.every((c) => gate.acknowledgedItems.includes(c));
    if (!allAcknowledged || (gate.requiresArbApproval && !gate.arbApproved)) {
      // Real ARB-approval-needed notification: only fires the first time a
      // Critical-tier use case is finalize-blocked purely on the missing
      // ARB sign-off (not on missing controls), so it doesn't spam on
      // every control-checklist attempt.
      if (allAcknowledged && gate.requiresArbApproval && !gate.arbApproved) {
        const useCase = await prisma.useCase.findUnique({ where: { id }, select: { title: true } });
        await sendNotification({
          kind: "arb_approval_needed",
          useCaseTitle: useCase?.title ?? id,
          useCaseId: id,
        });
      }
      return Response.json({ gate: toGate(gate) });
    }
    const [updated] = await prisma.$transaction([
      prisma.governanceGate.update({ where: { useCaseId: id }, data: { acknowledged: true, acknowledgedAt: new Date() } }),
      prisma.useCase.update({ where: { id }, data: { status: "gated" } }),
    ]);
    await logAuditEntry({
      useCaseId: id,
      actorUserId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: "gate_finalized",
    });
    await broadcastBundle(id);
    return Response.json({ gate: toGate(updated) });
  }

  if (body.action === "approveArb") {
    if (!canApproveArb(session.user.role as UserRole)) {
      return Response.json({ error: "Only an ARB member or Admin can approve this." }, { status: 403 });
    }
    const updated = await prisma.governanceGate.update({
      where: { useCaseId: id },
      data: {
        arbApproved: true,
        arbApprovedBy: session.user.name,
        arbApprovedAt: new Date(),
      },
    });
    await logAuditEntry({
      useCaseId: id,
      actorUserId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: "arb_approved",
    });
    await broadcastBundle(id);
    return Response.json({ gate: toGate(updated) });
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}
