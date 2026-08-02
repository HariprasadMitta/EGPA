import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can revoke API keys." }, { status: 403 });
  }

  const { id } = await params;
  await prisma.apiKey.update({ where: { id }, data: { revoked: true } });
  return Response.json({ ok: true });
}
