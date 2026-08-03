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
  const now = Date.now();
  return Response.json({
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      scope: k.scope,
      expiresAt: k.expiresAt?.toISOString() ?? null,
      expired: Boolean(k.expiresAt && k.expiresAt.getTime() < now),
      createdAt: k.createdAt.toISOString(),
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      revoked: k.revoked,
    })),
  });
}

const VALID_SCOPES = ["read", "read-write"];
// Nudges toward real key hygiene instead of defaulting to "never expires" -
// an admin can still explicitly choose null (never) via expiresInDays: null.
const VALID_EXPIRY_DAYS = [30, 90, 365];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can create API keys." }, { status: 403 });
  }

  let body: { name?: string; scope?: string; expiresInDays?: number | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return Response.json({ error: "A name is required (e.g. which external system this key is for)." }, { status: 400 });
  }
  const scope = body.scope ?? "read-write";
  if (!VALID_SCOPES.includes(scope)) {
    return Response.json({ error: "scope must be 'read' or 'read-write'." }, { status: 400 });
  }
  if (body.expiresInDays !== null && body.expiresInDays !== undefined && !VALID_EXPIRY_DAYS.includes(body.expiresInDays)) {
    return Response.json({ error: "expiresInDays must be 30, 90, 365, or null (never)." }, { status: 400 });
  }
  const expiresAt =
    body.expiresInDays != null ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000) : null;

  const plaintext = generateToken();
  const key = await prisma.apiKey.create({
    data: {
      name: body.name.trim(),
      keyHash: hashToken(plaintext),
      scope,
      expiresAt,
      createdByUserId: session.user.id,
    },
  });

  return Response.json({ id: key.id, name: key.name, scope: key.scope, expiresAt: key.expiresAt?.toISOString() ?? null, token: plaintext });
}
