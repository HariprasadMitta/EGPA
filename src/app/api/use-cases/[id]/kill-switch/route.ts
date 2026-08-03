import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toUseCase } from "@/lib/dbMapping";
import { broadcastBundle } from "@/lib/broadcastBundle";
import { canToggleKillSwitch } from "@/lib/roles";
import { hasActiveDelegation } from "@/lib/delegation";
import { logAuditEntry } from "@/lib/audit";
import { sendNotification } from "@/lib/notifications";
import { UserRole } from "@/types";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const delegated = await hasActiveDelegation(session.user.id, "governance_owner_actions");
  if (!canToggleKillSwitch(session.user.role as UserRole) && !delegated) {
    return Response.json(
      { error: "Only a Governance Owner, Admin, or someone with an active delegation can toggle the kill switch." },
      { status: 403 }
    );
  }

  const { id } = await params;

  let body: { engaged: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const engaged = Boolean(body.engaged);
  const updated = await prisma.useCase.update({
    where: { id },
    data: { killSwitchEngaged: engaged },
  });

  await logAuditEntry({
    useCaseId: id,
    actorUserId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: engaged ? "kill_switch_engaged" : "kill_switch_disengaged",
  });

  if (engaged) {
    await sendNotification({
      kind: "kill_switch_engaged",
      useCaseTitle: updated.title,
      useCaseId: id,
      actorName: session.user.name ?? "Unknown",
    });
  }

  await broadcastBundle(id);

  return Response.json({ useCase: toUseCase(updated) });
}
