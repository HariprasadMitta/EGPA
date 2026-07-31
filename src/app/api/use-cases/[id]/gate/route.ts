import { auth } from "@/auth";
import { canApproveArb } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { toGate } from "@/lib/dbMapping";
import { broadcastBundle } from "@/lib/broadcastBundle";
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
    await broadcastBundle(id);
    return Response.json({ gate: toGate(updated) });
  }

  if (body.action === "finalize") {
    const allAcknowledged = gate.requiredControls.every((c) => gate.acknowledgedItems.includes(c));
    if (!allAcknowledged || (gate.requiresArbApproval && !gate.arbApproved)) {
      return Response.json({ gate: toGate(gate) });
    }
    const [updated] = await prisma.$transaction([
      prisma.governanceGate.update({ where: { useCaseId: id }, data: { acknowledged: true } }),
      prisma.useCase.update({ where: { id }, data: { status: "gated" } }),
    ]);
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
    await broadcastBundle(id);
    return Response.json({ gate: toGate(updated) });
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}
