import { auth } from "@/auth";
import { canAccessDeveloperTools } from "@/lib/roles";
import { subscribeToFlowActivity } from "@/lib/eventBus";
import { UserRole } from "@/types";

export const runtime = "nodejs";

const HEARTBEAT_MS = 20_000;

// Org-wide real-time feed for ArchitectureDiagramWidget.tsx - every real
// request any signed-in user makes anywhere in the app publishes a flow-id
// pulse here (see the publishFlowActivity call sites), so this stream is
// genuine live traffic, not a scripted demo. Developer/Admin only, same
// gate as the widget itself, since it's a real-time view into org activity.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!canAccessDeveloperTools(session.user.role as UserRole)) {
    return Response.json({ error: "Developer or Admin access required." }, { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let unsubscribe: (() => void) | null = null;
      let aborted = false;

      subscribeToFlowActivity((event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }).then((unsub) => {
        if (aborted) {
          unsub();
        } else {
          unsubscribe = unsub;
        }
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
