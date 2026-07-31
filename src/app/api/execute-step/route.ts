import { runStep, StepInput } from "@/lib/agentStep";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rateLimit";
import { executionLimiter } from "@/lib/executionLimiter";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = clientIp(request);
  const gate = executionLimiter.check(ip);
  if (!gate.allowed) {
    return Response.json({ error: gate.reason }, { status: 429 });
  }

  let body: StepInput;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.step?.name || !body.step?.tool || !body.step?.task || !body.executionId || !body.stepId) {
    return Response.json({ error: "Missing required fields." }, { status: 400 });
  }

  const run = await prisma.executionRun.findUnique({
    where: { id: body.executionId },
    select: { useCaseId: true },
  });
  if (!run) return Response.json({ error: "Execution run not found." }, { status: 404 });
  const useCase = await prisma.useCase.findUnique({
    where: { id: run.useCaseId },
    select: { killSwitchEngaged: true },
  });
  if (useCase?.killSwitchEngaged) {
    return Response.json(
      { error: "Kill switch is engaged for this use case - execution is blocked." },
      { status: 403 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        for await (const event of runStep(body)) {
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
