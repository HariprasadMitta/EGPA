import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toUseCase } from "@/lib/dbMapping";
import { broadcastBundle } from "@/lib/broadcastBundle";
import { canToggleKillSwitch } from "@/lib/roles";
import { UserRole } from "@/types";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!canToggleKillSwitch(session.user.role as UserRole)) {
    return Response.json(
      { error: "Only a Governance Owner or Admin can toggle the kill switch." },
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

  const updated = await prisma.useCase.update({
    where: { id },
    data: { killSwitchEngaged: Boolean(body.engaged) },
  });

  await broadcastBundle(id);

  return Response.json({ useCase: toUseCase(updated) });
}
