import { prisma } from "@/lib/prisma";

export type DelegationScope = "arb_approval" | "governance_owner_actions";

// Real, time-boxed delegation check - a person can act with another's
// approval authority only while an active, non-revoked delegation for the
// right scope actually covers the current moment. This is the replacement
// for the unofficial workaround (credential sharing) real teams reach for
// when the only approver is on leave.
export async function hasActiveDelegation(delegateUserId: string, scope: DelegationScope): Promise<boolean> {
  const now = new Date();
  const match = await prisma.approvalDelegation.findFirst({
    where: {
      delegateUserId,
      scope,
      revoked: false,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
  });
  return Boolean(match);
}
