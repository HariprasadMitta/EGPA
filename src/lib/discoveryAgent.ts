import { gatewayChatThread, type ChatMessage } from "@/lib/litellm";
import { searchExistingUseCases } from "@/lib/discoveryTool";

export interface DiscoveryChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
}

export type DiscoveryPath = "process-only" | "extend-existing" | "research-first" | "build";

export interface DiscoveryFinalization {
  recommendedPath: DiscoveryPath;
  rationale: string;
}

const DISCOVERY_SYSTEM_PROMPT = `You are the Discovery Advisor inside an enterprise AI governance
platform. Your job is to help someone articulate a real business problem BEFORE any agent gets
built - ask clarifying questions, push back on vague requests, and check whether something
already covers this need.

You have exactly one real tool: search_existing_use_cases. To use it, respond with ONLY this JSON
object and nothing else: {"tool_call": {"name": "search_existing_use_cases", "query": "<search text>"}}
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
  "rationale": string (2-4 sentences on why this path over the other three - a real trade-off referencing specifics from the conversation, not a generic restatement)
}

Path definitions:
- "process-only": the problem is better solved by a non-AI process or policy fix; no agent is warranted.
- "extend-existing": an existing use case (surfaced via search_existing_use_cases in this conversation) already covers this need closely enough to extend rather than duplicate.
- "research-first": the org should invest time researching the problem space, data availability, or a build-vs-integrate decision before committing to a specific agent design.
- "build": a new use case is warranted and specific enough to take into Intake now.`;

function tryParseToolCall(text: string): { query: string } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.tool_call?.name === "search_existing_use_cases" && typeof parsed.tool_call.query === "string") {
      return { query: parsed.tool_call.query };
    }
  } catch {
    return null;
  }
  return null;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  return JSON.parse(candidate);
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

// Bounded (max one tool call per turn) real agent loop: send the
// conversation, and if the model asks for search_existing_use_cases, run
// the real DB search, feed the real result back, and get a final reply.
export async function runDiscoveryTurn(
  userId: string,
  history: DiscoveryChatMessage[],
  userMessage: string
): Promise<{ messages: DiscoveryChatMessage[]; reply: string; provider: string }> {
  const working: DiscoveryChatMessage[] = [...history, { role: "user", content: userMessage }];

  let result = await gatewayChatThread(toThreadMessages(working), 500);
  const toolCall = tryParseToolCall(result.text);

  if (toolCall) {
    const matches = await searchExistingUseCases(userId, toolCall.query);
    const toolResultText =
      matches.length === 0
        ? `No existing use cases matched "${toolCall.query}".`
        : `Found ${matches.length} existing use case(s) matching "${toolCall.query}":\n${matches
            .map((m) => `- ${m.title} (${m.status}, ${m.riskTier} tier, ${m.businessDomain})`)
            .join("\n")}`;
    working.push({ role: "tool", content: toolResultText });
    result = await gatewayChatThread(toThreadMessages(working), 500);
  }

  working.push({ role: "assistant", content: result.text });
  return { messages: working, reply: result.text, provider: result.provider };
}

function isValidFinalization(value: unknown): value is DiscoveryFinalization {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const paths: DiscoveryPath[] = ["process-only", "extend-existing", "research-first", "build"];
  return typeof v.rationale === "string" && paths.includes(v.recommendedPath as DiscoveryPath);
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
