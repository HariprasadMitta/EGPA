import { auth } from "@/auth";
import { subscribeToUseCaseUpdates } from "@/lib/eventBus";

export const runtime = "nodejs";

const HEARTBEAT_MS = 20_000;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const unsubscribe = subscribeToUseCaseUpdates((event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, HEARTBEAT_MS);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
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
