import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { DiscoveryChatMessage } from "@/lib/discoveryAgent";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const row = await prisma.problemDiscoverySession.findUnique({ where: { id } });
  if (!row || row.userId !== session.user.id) {
    return Response.json({ error: "Discovery session not found." }, { status: 404 });
  }

  return Response.json({
    id: row.id,
    title: row.title,
    status: row.status,
    messages: row.messages as unknown as DiscoveryChatMessage[],
    recommendedPath: row.recommendedPath,
    pathRationale: row.pathRationale,
    problemStatement: row.problemStatement,
    suggestedTitle: row.suggestedTitle,
    handedOffUseCaseId: row.handedOffUseCaseId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

// Sets the real link from a Discovery session to the UseCase it was handed
// off into - called by Intake right after a use case is created from a
// session's problem statement, closing the loop from advisory chat to
// governed submission. Owner-only, same as every other mutation here.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.problemDiscoverySession.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: "Discovery session not found." }, { status: 404 });
  }

  let body: { handedOffUseCaseId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.handedOffUseCaseId) {
    return Response.json({ error: "handedOffUseCaseId is required." }, { status: 400 });
  }

  const updated = await prisma.problemDiscoverySession.update({
    where: { id },
    data: { handedOffUseCaseId: body.handedOffUseCaseId },
  });

  return Response.json({ handedOffUseCaseId: updated.handedOffUseCaseId });
}

// Real delete - lets someone clean up an abandoned session instead of it
// sitting in the sidebar forever. Owner-only, same as every other mutation
// here.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.problemDiscoverySession.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: "Discovery session not found." }, { status: 404 });
  }

  await prisma.problemDiscoverySession.delete({ where: { id } });
  return Response.json({ ok: true });
}
