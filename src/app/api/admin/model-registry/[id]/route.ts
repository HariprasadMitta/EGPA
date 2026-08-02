import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can edit Model Registry entries." }, { status: 403 });
  }

  const { id } = await params;
  let body: { status?: string; allowedRiskTiers?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const entry = await prisma.modelRegistryEntry.update({
    where: { id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.allowedRiskTiers ? { allowedRiskTiers: body.allowedRiskTiers } : {}),
    },
  });

  return Response.json({ entry });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can remove Model Registry entries." }, { status: 403 });
  }

  const { id } = await params;
  await prisma.modelRegistryEntry.delete({ where: { id } });
  return Response.json({ ok: true });
}
