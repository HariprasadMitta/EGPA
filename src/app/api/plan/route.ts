import { PlanInput, runPlanning } from "@/lib/agentPlan";
import { clientIp } from "@/lib/rateLimit";
import { executionLimiter } from "@/lib/executionLimiter";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = clientIp(request);
  const gate = executionLimiter.check(ip);
  if (!gate.allowed) {
    return Response.json({ error: gate.reason }, { status: 429 });
  }

  let body: PlanInput;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.title || !Array.isArray(body.tools) || body.tools.length === 0) {
    return Response.json({ error: "Missing required fields." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        for await (const event of runPlanning(body)) {
          send(event);
          if (event.type === "done") executionLimiter.record(ip);
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
