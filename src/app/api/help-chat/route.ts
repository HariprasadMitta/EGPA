import { auth } from "@/auth";
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { buildAgentModel } from "@/lib/agentModel";
import { searchAppDocs } from "@/lib/knowledgeBase";
import { type ChatMessage } from "@/lib/litellm";
import { clientIp, createRateLimiter } from "@/lib/rateLimit";
import { publishFlowActivity } from "@/lib/eventBus";

export const runtime = "nodejs";

// Stateless on purpose - no session persisted to the DB, unlike Discovery
// Advisor's chat. This is a lightweight "how do I use this page" helper,
// not a use case in its own right, so the client just resends a short
// trailing window of history each turn rather than the server tracking a
// conversation row per user.
//
// Real retrieval, not a baked-in text dump: the model gets a short frame
// and a search_app_docs tool over the platform guide content embedded into
// Pinecone (see scripts/seed-app-docs.ts) - the same real Cohere/Pinecone
// path knowledge_base_search uses elsewhere, just a separate namespace.
const HELP_CHAT_SYSTEM_PROMPT = `You are the Help Assistant for EGPA, an enterprise AI governance
platform. Use the search_app_docs tool to look up real platform documentation before answering any
question about a specific page, button, role, or governance concept - never invent one that search
doesn't surface. Keep replies short (2-4 sentences), plain text, no markdown. If someone asks something
unrelated to using this platform, say you can only help with EGPA itself.`;

const MAX_HISTORY_MESSAGES = 8;
const MAX_TOOL_ROUNDS = 2;
const helpChatLimiter = createRateLimiter(20, 300);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const ip = clientIp(request);
  const gate = helpChatLimiter.check(ip);
  if (!gate.allowed) return Response.json({ error: gate.reason }, { status: 429 });

  let body: { message?: string; history?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const message = body.message?.trim();
  if (!message) return Response.json({ error: "message is required." }, { status: 400 });
  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_MESSAGES) : [];
  publishFlowActivity("help");

  try {
    const { model: gatewayModel } = buildAgentModel();
    const model = gatewayModel.bindTools([searchAppDocs]);

    const messages: BaseMessage[] = [
      new SystemMessage(HELP_CHAT_SYSTEM_PROMPT),
      ...history.map((m) => (m.role === "assistant" ? new AIMessage(m.content) : new HumanMessage(m.content))),
      new HumanMessage(message),
    ];

    let response = await model.invoke(messages);

    for (let round = 0; round < MAX_TOOL_ROUNDS && response.tool_calls?.length; round++) {
      messages.push(response);
      for (const call of response.tool_calls) {
        publishFlowActivity("help", "tool_call", call.name);
        let result: string;
        try {
          result = String(await searchAppDocs.invoke(call.args as { query: string }));
        } catch (err) {
          result = `Tool error: ${(err as Error).message}`;
        }
        publishFlowActivity("help", "tool_result", call.name);
        messages.push(new ToolMessage({ content: result, tool_call_id: call.id ?? "" }));
      }
      response = await model.invoke(messages);
    }

    helpChatLimiter.record(ip);
    return Response.json({ reply: typeof response.content === "string" ? response.content : String(response.content) });
  } catch (err) {
    return Response.json({ error: `Help Assistant error: ${(err as Error).message}` }, { status: 502 });
  }
}
