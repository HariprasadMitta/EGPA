import { gatewayChatThread, type ChatMessage } from "@/lib/litellm";
import { searchExistingUseCases } from "@/lib/discoveryTool";
import { extractJson } from "@/lib/extractJson";

export interface DiscoveryChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
}

export type DiscoveryPath = "process-only" | "extend-existing" | "research-first" | "build";

export interface DiscoveryFinalization {
  recommendedPath: DiscoveryPath;
  rationale: string;
  problemStatement: string;
  suggestedTitle: string;
}

const DISCOVERY_SYSTEM_PROMPT = `You are the Discovery Advisor inside an enterprise AI governance
platform. Your job is to help someone articulate a real business problem BEFORE any agent gets
built - ask clarifying questions, push back on vague requests, and check whether something
already covers this need.

You have exactly one real tool: search_existing_use_cases. To use it, respond with ONLY this JSON
object and NOTHING else - no preamble like "let me check", no explanation before or after it, just
the raw JSON on its own: {"tool_call": {"name": "search_existing_use_cases", "query": "<search text>"}}
Only call it once you understand the problem well enough to search meaningfully - never on the
very first message before asking at least one clarifying question.

Otherwise, reply in plain conversational text (no JSON, no markdown headers, no bullet lists) -
ask one focused clarifying question at a time. Once you have enough to go on, tell the user they
can ask you to "wrap this up" for a structured recommendation.

Never default to "build an agent" - a real share of business problems are better solved by a
process or policy fix, by reusing something that already exists, or by researching the problem
space before committing to a specific design. Stay skeptical and concrete, and keep replies short
(2-4 sentences).`;

const FINALIZE_SYSTEM_PROMPT = `Given the full Discovery Advisor conversation below, conclude it.
Respond with ONLY a JSON object (no markdown fences, no prose outside the JSON) matching exactly
this shape:

{
  "recommendedPath": "process-only" | "extend-existing" | "research-first" | "build",
  "rationale": string (2-4 sentences on why this path over the other three - a real trade-off referencing specifics from the conversation, not a generic restatement),
  "suggestedTitle": string (a short, specific title for this potential use case, e.g. "Employee Expense Anomaly Detection Agent" - not generic like "AI Agent"),
  "problemStatement": string (a detailed, submission-ready paragraph - 4-8 sentences - synthesizing EVERY concrete detail actually surfaced in this conversation: the specific business problem, real numbers/volumes mentioned, the current manual process and why it's a problem, the specific criteria or rules discussed, and what was found (or not found) when checking for an existing solution. Written in third person as a standalone problem description, detailed enough that someone could paste it directly into a use case submission form's description field without having to re-explain anything already said in this chat. Do not just restate the opening message - it must incorporate the follow-up detail gathered afterward.)
}

Path definitions:
- "process-only": the problem is better solved by a non-AI process or policy fix; no agent is warranted.
- "extend-existing": an existing use case (surfaced via search_existing_use_cases in this conversation) already covers this need closely enough to extend rather than duplicate.
- "research-first": the org should invest time researching the problem space, data availability, or a build-vs-integrate decision before committing to a specific agent design.
- "build": a new use case is warranted and specific enough to take into Intake now.

Respond with valid JSON on a single logical structure - do not put a literal line break inside any string value, use the sequence \\n if you need one.`;

// Locates the {"tool_call": {...}} object anywhere inside a real model
// response and returns just that substring - real, observed failure mode:
// a smaller model sometimes wraps the JSON in prose ("Let me check...
// {"tool_call": ...}") despite being told not to, which a naive
// text.startsWith("{") check misses entirely, silently leaking the raw
// JSON into the visible chat AND never actually firing the tool. A
// balanced-brace scan (respecting string boundaries, same technique as
// extractJson's sanitizer) finds it regardless of what surrounds it.
export function findToolCallJson(text: string): string | null {
  const marker = '{"tool_call"';
  const start = text.indexOf(marker);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function tryParseToolCall(text: string): { query: string } | null {
  const candidate = findToolCallJson(text);
  if (!candidate) return null;
  try {
    const parsed = JSON.parse(candidate);
    if (parsed?.tool_call?.name === "search_existing_use_cases" && typeof parsed.tool_call.query === "string") {
      return { query: parsed.tool_call.query };
    }
  } catch {
    return null;
  }
  return null;
}

function toThreadMessages(history: DiscoveryChatMessage[]): ChatMessage[] {
  return [
    { role: "system", content: DISCOVERY_SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: (m.role === "tool" ? "assistant" : m.role) as "user" | "assistant",
      content: m.role === "tool" ? `[Tool result] ${m.content}` : m.content,
    })),
  ];
}

// Real, live turn-state telemetry - additive event stream so the UI can
// show what's actually happening right now (thinking / calling the real
// tool / composing the reply) instead of a static "Thinking..." label with
// no visibility into which phase a turn is in. Every consumer of the old
// one-shot runDiscoveryTurn was this session's own API route, so this
// fully replaces it rather than living alongside it.
export type DiscoveryTurnEvent =
  | { type: "thinking" }
  | { type: "tool_call"; toolName: string; query: string }
  | { type: "tool_result"; toolName: string; result: string }
  | { type: "done"; messages: DiscoveryChatMessage[]; reply: string; provider: string }
  | { type: "error"; error: string };

// Bounded (max one tool call per turn) real agent loop: send the
// conversation, and if the model asks for search_existing_use_cases, run
// the real DB search, feed the real result back, and get a final reply -
// yielding a real event at each phase transition.
export async function* runDiscoveryTurn(
  userId: string,
  history: DiscoveryChatMessage[],
  userMessage: string
): AsyncGenerator<DiscoveryTurnEvent> {
  const working: DiscoveryChatMessage[] = [...history, { role: "user", content: userMessage }];

  yield { type: "thinking" };
  let result;
  try {
    result = await gatewayChatThread(toThreadMessages(working), 500);
  } catch (err) {
    yield { type: "error", error: `Discovery Advisor error: ${(err as Error).message}` };
    return;
  }
  const toolCall = tryParseToolCall(result.text);

  if (toolCall) {
    yield { type: "tool_call", toolName: "search_existing_use_cases", query: toolCall.query };
    const matches = await searchExistingUseCases(userId, toolCall.query);
    const toolResultText =
      matches.length === 0
        ? `No existing use cases matched "${toolCall.query}".`
        : `Found ${matches.length} existing use case(s) matching "${toolCall.query}":\n${matches
            .map((m) => `- ${m.title} (${m.status}, ${m.riskTier} tier, ${m.businessDomain})`)
            .join("\n")}`;
    yield { type: "tool_result", toolName: "search_existing_use_cases", result: toolResultText };
    working.push({ role: "tool", content: toolResultText });

    yield { type: "thinking" };
    try {
      result = await gatewayChatThread(toThreadMessages(working), 500);
    } catch (err) {
      yield { type: "error", error: `Discovery Advisor error: ${(err as Error).message}` };
      return;
    }
  }

  working.push({ role: "assistant", content: result.text });
  yield { type: "done", messages: working, reply: result.text, provider: result.provider };
}

function isValidFinalization(value: unknown): value is DiscoveryFinalization {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const paths: DiscoveryPath[] = ["process-only", "extend-existing", "research-first", "build"];
  return (
    typeof v.rationale === "string" &&
    typeof v.problemStatement === "string" &&
    typeof v.suggestedTitle === "string" &&
    paths.includes(v.recommendedPath as DiscoveryPath)
  );
}

export async function finalizeDiscoverySession(messages: DiscoveryChatMessage[]): Promise<DiscoveryFinalization> {
  const transcript = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
  const result = await gatewayChatThread(
    [
      { role: "system", content: FINALIZE_SYSTEM_PROMPT },
      { role: "user", content: transcript },
    ],
    500
  );
  const parsed = extractJson(result.text);
  if (!isValidFinalization(parsed)) {
    throw new Error(`Discovery Advisor (${result.provider}) returned an unexpected shape when finalizing.`);
  }
  return parsed;
}
