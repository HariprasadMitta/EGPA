import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Real Slack incoming-webhook configuration - global (one channel receives
// every notification event), Admin-only. GET never returns the actual
// webhookUrl to non-admins (it's a real credential, same discipline as
// every other secret in this app), only whether one is configured.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const channel = await prisma.notificationChannel.findFirst({ where: { kind: "slack" } });
  const isAdmin = session.user.role === "admin";

  return Response.json({
    configured: Boolean(channel),
    enabled: channel?.enabled ?? false,
    webhookUrl: isAdmin ? channel?.webhookUrl ?? null : null,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can configure notifications." }, { status: 403 });
  }

  let body: { webhookUrl?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.webhookUrl || !body.webhookUrl.startsWith("https://")) {
    return Response.json({ error: "A real https:// Slack webhook URL is required." }, { status: 400 });
  }

  const existing = await prisma.notificationChannel.findFirst({ where: { kind: "slack" } });
  const channel = existing
    ? await prisma.notificationChannel.update({ where: { id: existing.id }, data: { webhookUrl: body.webhookUrl, enabled: true } })
    : await prisma.notificationChannel.create({ data: { kind: "slack", webhookUrl: body.webhookUrl, enabled: true } });

  return Response.json({ configured: true, enabled: channel.enabled });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can configure notifications." }, { status: 403 });
  }

  let body: { enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const existing = await prisma.notificationChannel.findFirst({ where: { kind: "slack" } });
  if (!existing) return Response.json({ error: "No notification channel configured yet." }, { status: 404 });

  const channel = await prisma.notificationChannel.update({
    where: { id: existing.id },
    data: { enabled: Boolean(body.enabled) },
  });

  return Response.json({ configured: true, enabled: channel.enabled });
}
