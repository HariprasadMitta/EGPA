import { prisma } from "@/lib/prisma";
import { computeEntryHash, GENESIS } from "@/lib/auditChain";

export type AuditAction =
  | "kill_switch_engaged"
  | "kill_switch_disengaged"
  | "control_acknowledged"
  | "control_unacknowledged"
  | "gate_finalized"
  | "arb_approved"
  | "drift_detected"
  | "anomaly_detected"
  | "comment_added"
  | "recertification_attested"
  | "arb_approval_needed"
  | "stale_approval_escalated"
  | "material_change_reapproval"
  | "undeclared_tool_detected"
  | "preflight_check_denied";

// Real governance action audit trail - who changed what and when. Every
// human-driven state change routes through this instead of only leaving
// the current state visible (e.g. killSwitchEngaged as a bare boolean with
// no history of who flipped it or when).
export async function logAuditEntry(input: {
  useCaseId: string;
  actorUserId?: string | null;
  actorName: string;
  action: AuditAction;
  detail?: string;
}): Promise<void> {
  const previous = await prisma.auditLogEntry.findFirst({
    where: { useCaseId: input.useCaseId },
    orderBy: { createdAt: "desc" },
    select: { hash: true },
  });
  const prevHash = previous?.hash || GENESIS;

  const createdAt = new Date();
  const fields = {
    useCaseId: input.useCaseId,
    actorUserId: input.actorUserId ?? null,
    actorName: input.actorName,
    action: input.action,
    detail: input.detail ?? null,
    createdAt,
  };
  const hash = computeEntryHash(prevHash, fields);

  await prisma.auditLogEntry.create({
    data: { ...fields, prevHash, hash },
  });
}
