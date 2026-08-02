import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "kill_switch_engaged"
  | "kill_switch_disengaged"
  | "control_acknowledged"
  | "control_unacknowledged"
  | "gate_finalized"
  | "arb_approved"
  | "drift_detected"
  | "anomaly_detected"
  | "comment_added";

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
  await prisma.auditLogEntry.create({
    data: {
      useCaseId: input.useCaseId,
      actorUserId: input.actorUserId ?? null,
      actorName: input.actorName,
      action: input.action,
      detail: input.detail ?? null,
    },
  });
}
