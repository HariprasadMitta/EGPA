import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can configure notifications." }, { status: 403 });
  }

  const { id } = await params;
  let body: { enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const channel = await prisma.notificationChannel.update({
    where: { id },
    data: { enabled: Boolean(body.enabled) },
  });

  return Response.json({ id: channel.id, enabled: channel.enabled });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can configure notifications." }, { status: 403 });
  }

  const { id } = await params;
  await prisma.notificationChannel.delete({ where: { id } });
  return Response.json({ ok: true });
}
