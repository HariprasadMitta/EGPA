import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAuditEntry } from "@/lib/audit";
import { broadcastBundle } from "@/lib/broadcastBundle";

export const runtime = "nodejs";

// Real discussion thread per use case - governance review in practice
// involves back-and-forth (ARB asking a clarifying question, a governance
// owner leaving a note), which had no home anywhere in this app before.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const comments = await prisma.comment.findMany({
    where: { useCaseId: id },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({
    comments: comments.map((c) => ({
      id: c.id,
      useCaseId: c.useCaseId,
      authorName: c.authorName,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  let body: { body?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.body || !body.body.trim()) {
    return Response.json({ error: "Comment body is required." }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      useCaseId: id,
      authorUserId: session.user.id,
      authorName: session.user.name ?? "Unknown",
      body: body.body.trim(),
    },
  });

  await logAuditEntry({
    useCaseId: id,
    actorUserId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "comment_added",
  });
  await broadcastBundle(id);

  return Response.json({
    comment: {
      id: comment.id,
      useCaseId: comment.useCaseId,
      authorName: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    },
  });
}
