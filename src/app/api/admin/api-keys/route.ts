import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/webhookAuth";
import { hashToken } from "@/lib/apiKeyAuth";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can manage API keys." }, { status: 403 });
  }

  const keys = await prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } });
  return Response.json({
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      createdAt: k.createdAt.toISOString(),
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      revoked: k.revoked,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can create API keys." }, { status: 403 });
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return Response.json({ error: "A name is required (e.g. which external system this key is for)." }, { status: 400 });
  }

  const plaintext = generateToken();
  const key = await prisma.apiKey.create({
    data: { name: body.name.trim(), keyHash: hashToken(plaintext), createdByUserId: session.user.id },
  });

  return Response.json({ id: key.id, name: key.name, token: plaintext });
}
