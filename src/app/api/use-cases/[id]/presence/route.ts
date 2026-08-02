import { auth } from "@/auth";
import { publishPresence, subscribeToPresence } from "@/lib/presence";

export const runtime = "nodejs";

const HEARTBEAT_MS = 20_000;

// Real "who else is looking at this" - a real presence ping published to
// Redis (src/lib/presence.ts) every time a client calls POST, and a real
// SSE stream (GET) forwarding other clients' pings for the same use case -
// same broadcast mechanism as the live-sync bundle updates, just a
// separate real-time signal.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  await publishPresence({ useCaseId: id, userName: session.user.name ?? "Unknown", at: Date.now() });
  return Response.json({ ok: true });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let unsubscribe: (() => void) | null = null;
      let aborted = false;

      subscribeToPresence((ping) => {
        if (ping.useCaseId !== id) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ping)}\n\n`));
      }).then((unsub) => {
        if (aborted) unsub();
        else unsubscribe = unsub;
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, HEARTBEAT_MS);

      request.signal.addEventListener("abort", () => {
        aborted = true;
        clearInterval(heartbeat);
        unsubscribe?.();
        controller.close();
      });
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
