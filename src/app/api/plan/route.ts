import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { buildAgentModel, resolveAgentProvider } from "@/lib/agentModel";
import { estimateCostUsd } from "@/lib/pricing";
import { clientIp } from "@/lib/rateLimit";
import { executionLimiter, MAX_STEPS } from "@/lib/executionLimiter";

export const runtime = "nodejs";

interface PlanRequestBody {
  title: string;
  description: string;
  riskTier: string;
  framework: string;
  tools: string[];
  harnessPattern: string;
}

// NDJSON instead of one JSON blob: a single JSON object can't be usefully
// parsed/displayed mid-stream, but a complete line can be forwarded to the
// client the moment it's finished, giving a genuinely real-time "steps
// appearing as they're decided" feel instead of an opaque spinner.
function buildSystemPrompt(tools: string[], maxSteps: number): string {
  return `You are the master agent in a multi-agent execution system. Break the
approved recommendation into ${Math.min(2, maxSteps)}-${maxSteps} concrete sub-agent
steps. Each step's "tool" field must be one of these available tools: ${tools.join(", ")}.

Respond with ONLY newline-delimited JSON (NDJSON) - one complete, valid
JSON object per line, no markdown fences, no prose, no surrounding array or
braces. Every string value MUST be wrapped in double quotes - this is
plain JSON, not any other format. The first line must be a summary line,
followed by one line per step, in exactly this format (this example is
illustrative only, write your own real content specific to this use case):
{"type":"summary","text":"Classify incoming tickets and route them to the right queue."}
{"type":"step","name":"Ticket Classifier","tool":"Ticketing system API","task":"Read the incoming ticket and classify its category."}`;
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const gate = executionLimiter.check(ip);
  if (!gate.allowed) {
    return Response.json({ error: gate.reason }, { status: 429 });
  }

  let provider: ReturnType<typeof resolveAgentProvider>;
  try {
    provider = resolveAgentProvider();
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }

  let body: PlanRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.title || !Array.isArray(body.tools) || body.tools.length === 0) {
    return Response.json({ error: "Missing required fields." }, { status: 400 });
  }

  const userMessage = `Use case: ${body.title}
Risk tier: ${body.riskTier}
Framework: ${body.framework}
Harness pattern: ${body.harnessPattern}
Available tools: ${body.tools.join(", ")}

Description:
${body.description}`;

  const model = buildAgentModel(provider);
  const start = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      let buffer = "";
      let stepCount = 0;
      let inputTokens = 0;
      let outputTokens = 0;

      function flushCompleteLines(finalFlush: boolean) {
        const parts = buffer.split("\n");
        buffer = finalFlush ? "" : (parts.pop() ?? "");
        for (const rawLine of parts) {
          const line = rawLine.trim();
          if (!line) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === "step") stepCount += 1;
            if (parsed.type === "step" && stepCount > MAX_STEPS) continue;
            send(parsed);
          } catch {
            // Garbled/incomplete line - skip rather than crash the stream,
            // consistent with this app's existing tolerance for occasional
            // degenerate free-tier model output.
          }
        }
      }

      try {
        const events = await model.stream([
          new SystemMessage(buildSystemPrompt(body.tools, MAX_STEPS)),
          new HumanMessage(userMessage),
        ]);

        for await (const chunk of events) {
          const text = typeof chunk.content === "string" ? chunk.content : "";
          if (text) {
            buffer += text;
            flushCompleteLines(false);
          }
          if (chunk.usage_metadata) {
            inputTokens = chunk.usage_metadata.input_tokens ?? inputTokens;
            outputTokens = chunk.usage_metadata.output_tokens ?? outputTokens;
          }
        }
        flushCompleteLines(true);

        executionLimiter.record(ip);

        send({
          type: "done",
          provider,
          inputTokens,
          outputTokens,
          costUsd: estimateCostUsd(provider, inputTokens, outputTokens),
          durationMs: Date.now() - start,
        });
      } catch (err) {
        send({ type: "error", error: `Master agent planning error: ${(err as Error).message}` });
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
