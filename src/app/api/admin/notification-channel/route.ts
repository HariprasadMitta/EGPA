import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publishFlowActivity } from "@/lib/eventBus";

export const runtime = "nodejs";

const VALID_KINDS = ["slack", "teams", "generic-webhook"];

// Real, multi-channel outbound notifications - Admin-only. More than one
// channel can be enabled at once (e.g. Slack for the team plus a generic
// webhook feeding a GRC/ITSM system's own intake automation), and every
// enabled channel receives every real governance event (see
// src/lib/notifications.ts). GET never returns the actual webhookUrl to
// non-admins - it's a real credential, same discipline as every other
// secret in this app.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const channels = await prisma.notificationChannel.findMany({ orderBy: { createdAt: "asc" } });
  const isAdmin = session.user.role === "admin";

  return Response.json({
    channels: channels.map((c) => ({
      id: c.id,
      kind: c.kind,
      enabled: c.enabled,
      webhookUrl: isAdmin ? c.webhookUrl : null,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can configure notifications." }, { status: 403 });
  }

  let body: { kind?: string; webhookUrl?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const kind = body.kind ?? "slack";
  if (!VALID_KINDS.includes(kind)) {
    return Response.json({ error: "kind must be 'slack', 'teams', or 'generic-webhook'." }, { status: 400 });
  }
  if (!body.webhookUrl || !body.webhookUrl.startsWith("https://")) {
    return Response.json({ error: "A real https:// webhook URL is required." }, { status: 400 });
  }
  publishFlowActivity("admin");

  const channel = await prisma.notificationChannel.create({
    data: { kind, webhookUrl: body.webhookUrl, enabled: true },
  });

  return Response.json({ id: channel.id, kind: channel.kind, enabled: channel.enabled });
}
