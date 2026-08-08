import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runDiscoveryTurn, type DiscoveryChatMessage } from "@/lib/discoveryAgent";

export const runtime = "nodejs";

function deriveTitle(messages: DiscoveryChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New discovery session";
  return firstUser.content.length > 60 ? `${firstUser.content.slice(0, 60)}...` : firstUser.content;
}

// Real turn in the Discovery Advisor's chat - an actual LLM call through
// the same AI Gateway every other agent path in this platform uses (see
// src/lib/discoveryAgent.ts), not a scripted flow. Persists the full real
// transcript (including any search_existing_use_cases tool call/result)
// after every turn so a session survives a page refresh.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const row = await prisma.problemDiscoverySession.findUnique({ where: { id } });
  if (!row || row.userId !== session.user.id) {
    return Response.json({ error: "Discovery session not found." }, { status: 404 });
  }
  if (row.status !== "active") {
    return Response.json({ error: "This session has already been finalized." }, { status: 400 });
  }

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const message = body.message?.trim();
  if (!message) return Response.json({ error: "message is required." }, { status: 400 });

  const history = row.messages as unknown as DiscoveryChatMessage[];

  try {
    const { messages, reply } = await runDiscoveryTurn(session.user.id, history, message);

    const updated = await prisma.problemDiscoverySession.update({
      where: { id },
      data: {
        messages: messages as unknown as object,
        title: row.title ?? deriveTitle(messages),
      },
    });

    return Response.json({
      reply,
      messages,
      title: updated.title,
    });
  } catch (err) {
    return Response.json({ error: `Discovery Advisor error: ${(err as Error).message}` }, { status: 502 });
  }
}
