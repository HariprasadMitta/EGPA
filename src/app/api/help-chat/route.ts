import { auth } from "@/auth";
import { gatewayChatThread, type ChatMessage } from "@/lib/litellm";
import { PLATFORM_GUIDE_CONTEXT } from "@/lib/guideContent";
import { clientIp, createRateLimiter } from "@/lib/rateLimit";
import { publishFlowActivity } from "@/lib/eventBus";

export const runtime = "nodejs";

// Stateless on purpose - no session persisted to the DB, unlike Discovery
// Advisor's chat. This is a lightweight "how do I use this page" helper,
// not a use case in its own right, so the client just resends a short
// trailing window of history each turn rather than the server tracking a
// conversation row per user.
const HELP_CHAT_SYSTEM_PROMPT = `You are the Help Assistant for EGPA, an enterprise AI governance
platform. Answer questions about how to use the app, using ONLY the real platform description below -
never invent a page, button, or feature that isn't described here. Keep replies short (2-4 sentences),
plain text, no markdown. If someone asks something unrelated to using this platform, say you can only
help with EGPA itself.

${PLATFORM_GUIDE_CONTEXT}`;

const MAX_HISTORY_MESSAGES = 8;
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
    const result = await gatewayChatThread(
      [
        { role: "system", content: HELP_CHAT_SYSTEM_PROMPT },
        ...history,
        { role: "user", content: message },
      ],
      300
    );
    helpChatLimiter.record(ip);
    return Response.json({ reply: result.text });
  } catch (err) {
    return Response.json({ error: `Help Assistant error: ${(err as Error).message}` }, { status: 502 });
  }
}
