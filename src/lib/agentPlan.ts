import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { buildAgentModel } from "@/lib/agentModel";
import { estimateCostUsd } from "@/lib/pricing";
import { MAX_STEPS } from "@/lib/executionLimiter";

export interface PlanInput {
  title: string;
  description: string;
  riskTier: string;
  framework: string;
  tools: string[];
  harnessPattern: string;
}

export type PlanEvent =
  | { type: "summary"; text: string }
  | { type: "step"; name: string; tool: string; task: string }
  | {
      type: "done";
      provider: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      durationMs: number;
    }
  | { type: "error"; error: string };

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

// Shared by both /api/plan (streams these events to the browser as SSE) and
// the webhook trigger route (consumes them headlessly to completion) - one
// implementation of prompt-building/NDJSON-parsing/allowlist-filtering so
// the two entry points can't drift or under-enforce relative to each other.
export async function* runPlanning(input: PlanInput): AsyncGenerator<PlanEvent> {
  const start = Date.now();
  const userMessage = `Use case: ${input.title}
Risk tier: ${input.riskTier}
Framework: ${input.framework}
Harness pattern: ${input.harnessPattern}
Available tools: ${input.tools.join(", ")}

Description:
${input.description}`;

  const { model, getLastModelName } = buildAgentModel();
  const allowedTools = new Set(input.tools);

  let buffer = "";
  let stepCount = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  function* flushCompleteLines(finalFlush: boolean): Generator<PlanEvent> {
    const parts = buffer.split("\n");
    buffer = finalFlush ? "" : (parts.pop() ?? "");
    for (const rawLine of parts) {
      const line = rawLine.trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "step") {
          // Tool allowlist enforcement: never forward a step whose tool
          // isn't actually in the recommendation's approved tool stack,
          // whether from a model mistake or a tampered prompt.
          if (typeof parsed.tool !== "string" || !allowedTools.has(parsed.tool)) continue;
          stepCount += 1;
          if (stepCount > MAX_STEPS) continue;
        }
        yield parsed as PlanEvent;
      } catch {
        // Garbled/incomplete line - skip rather than crash the stream,
        // consistent with this app's existing tolerance for occasional
        // degenerate free-tier model output.
      }
    }
  }

  try {
    const events = await model.stream([
      new SystemMessage(buildSystemPrompt(input.tools, MAX_STEPS)),
      new HumanMessage(userMessage),
    ]);

    for await (const chunk of events) {
      const text = typeof chunk.content === "string" ? chunk.content : "";
      if (text) {
        buffer += text;
        yield* flushCompleteLines(false);
      }
      if (chunk.usage_metadata) {
        inputTokens = chunk.usage_metadata.input_tokens ?? inputTokens;
        outputTokens = chunk.usage_metadata.output_tokens ?? outputTokens;
      }
    }
    yield* flushCompleteLines(true);

    const modelName = getLastModelName();
    yield {
      type: "done",
      provider: modelName ?? "momentum-primary",
      inputTokens,
      outputTokens,
      costUsd: estimateCostUsd(modelName, inputTokens, outputTokens),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    yield { type: "error", error: `Master agent planning error: ${(err as Error).message}` };
  }
}
