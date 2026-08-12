import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runDiscoveryTurn, type DiscoveryChatMessage } from "@/lib/discoveryAgent";
import { publishFlowActivity } from "@/lib/eventBus";

export const runtime = "nodejs";

function deriveTitle(messages: DiscoveryChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New discovery session";
  return firstUser.content.length > 60 ? `${firstUser.content.slice(0, 60)}...` : firstUser.content;
}

// Real turn in the Discovery Advisor's chat, streamed as SSE - an actual
// LLM call through the same AI Gateway every other agent path in this
// platform uses (see src/lib/discoveryAgent.ts), not a scripted flow.
// Streaming (rather than one JSON response) is what lets the UI show real
// turn-state (thinking / calling the real tool / composing the reply)
// instead of a static "Thinking..." label with no visibility into what
// phase a turn is in - same reasoning as /api/execute-step's SSE stream.
// Persists the full real transcript (including any tool call/result) once
// the turn completes, so a session survives a page refresh.
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
  publishFlowActivity("discovery");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        for await (const event of runDiscoveryTurn(session.user.id, history, message)) {
          if (event.type === "done") {
            const updated = await prisma.problemDiscoverySession.update({
              where: { id },
              data: {
                messages: event.messages as unknown as object,
                title: row.title ?? deriveTitle(event.messages),
              },
            });
            send({ type: "done", reply: event.reply, messages: event.messages, title: updated.title });
          } else {
            send(event);
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
