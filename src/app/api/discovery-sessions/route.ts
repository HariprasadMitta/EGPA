import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { DiscoveryChatMessage } from "@/lib/discoveryAgent";

export const runtime = "nodejs";

// Real, persisted Discovery Advisor sessions - a chat that runs before
// Intake to help someone articulate a business problem before jumping to
// "build an agent." Always scoped to the signed-in user's own sessions;
// there's no cross-user visibility here (unlike UseCase's org-wide
// oversight roles) since this is personal pre-work, not a governed record.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const sessions = await prisma.problemDiscoverySession.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      title: true,
      status: true,
      recommendedPath: true,
      handedOffUseCaseId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return Response.json({ sessions });
}

export async function POST() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const messages: DiscoveryChatMessage[] = [];
  const created = await prisma.problemDiscoverySession.create({
    data: { userId: session.user.id, messages: messages as unknown as object, status: "active" },
  });

  return Response.json({
    id: created.id,
    title: created.title,
    status: created.status,
    messages: [],
    recommendedPath: created.recommendedPath,
    pathRationale: created.pathRationale,
    handedOffUseCaseId: created.handedOffUseCaseId,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  });
}
