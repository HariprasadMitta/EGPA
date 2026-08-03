import { auth } from "@/auth";
import { canApproveArb, canToggleKillSwitch } from "@/lib/roles";
import { hasActiveDelegation } from "@/lib/delegation";
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
  | { action: "approveArb" }
  | { action: "attest" };

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
        // Real timestamped record of "when did this first get stuck waiting
        // on ARB" - the only place that's actually recorded, since nothing
        // else stores a "pending since" moment. Used by the stale-approval
        // escalation job (src/app/api/admin/escalate-stale-approvals) to
        // compute real days-pending, not an estimate.
        await logAuditEntry({
          useCaseId: id,
          actorName: "System",
          action: "arb_approval_needed",
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
    const delegated = await hasActiveDelegation(session.user.id, "arb_approval");
    if (!canApproveArb(session.user.role as UserRole) && !delegated) {
      return Response.json({ error: "Only an ARB member, Admin, or someone with an active ARB delegation can approve this." }, { status: 403 });
    }
    // Real segregation of duties: the account that owns this use case can't
    // also be the one clearing its ARB sign-off, even if they happen to
    // hold the arb/admin role too - a classic first-week audit finding if
    // left unenforced. Checked against the real ownerUserId (the account
    // that submitted it), not the free-text owner/steward display names,
    // which can't be reliably matched back to an account.
    const useCase = await prisma.useCase.findUnique({ where: { id }, select: { ownerUserId: true } });
    if (useCase?.ownerUserId === session.user.id) {
      return Response.json(
        { error: "You own this use case and can't also approve its own ARB sign-off - segregation of duties requires a different approver." },
        { status: 403 }
      );
    }
    const updated = await prisma.governanceGate.update({
      where: { useCaseId: id },
      data: {
        arbApproved: true,
        arbApprovedBy: delegated ? `${session.user.name} (via delegation)` : session.user.name,
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

  if (body.action === "attest") {
    const delegatedAttest = await hasActiveDelegation(session.user.id, "governance_owner_actions");
    if (!canToggleKillSwitch(session.user.role as UserRole) && !delegatedAttest) {
      return Response.json({ error: "Only a Governance Owner, Admin, or someone with an active delegation can attest recertification." }, { status: 403 });
    }
    if (!gate.acknowledged) {
      return Response.json({ error: "This use case's gate hasn't been acknowledged yet - nothing to re-attest." }, { status: 400 });
    }
    // Real, distinct action from the original sign-off: confirms "this still
    // matches production" and resets the recertification clock
    // (acknowledgedAt), without silently re-running the original checklist
    // toggle-by-toggle or touching ARB approval state.
    const updated = await prisma.governanceGate.update({
      where: { useCaseId: id },
      data: { acknowledgedAt: new Date() },
    });
    await logAuditEntry({
      useCaseId: id,
      actorUserId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: "recertification_attested",
      detail: "Confirmed this use case's implementation still matches its governance sign-off.",
    });
    await broadcastBundle(id);
    return Response.json({ gate: toGate(updated) });
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}
