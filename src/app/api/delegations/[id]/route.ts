import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const delegation = await prisma.approvalDelegation.findUnique({ where: { id } });
  if (!delegation) return Response.json({ error: "Delegation not found." }, { status: 404 });

  const isOwnerOfDelegation = delegation.delegatorUserId === session.user.id;
  if (!isOwnerOfDelegation && session.user.role !== "admin") {
    return Response.json({ error: "Only the person who created this delegation or an Admin can revoke it." }, { status: 403 });
  }

  await prisma.approvalDelegation.update({ where: { id }, data: { revoked: true } });
  return Response.json({ ok: true });
}
