import { prisma } from "@/lib/prisma";
import { hashToken, verifyToken } from "@/lib/webhookAuth";

// Real platform API key auth for src/app/api/public/* - a genuine REST
// surface external enterprise systems can call, distinct from the
// browser's cookie/JWT session (src/auth.ts) and from the one-use-case-
// scoped WebhookTrigger token. Reuses the same real hash/verify primitives
// webhook tokens already use - only the hash is ever stored.
export async function authenticateApiKey(request: Request): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("authorization") ?? "";
  const providedKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!providedKey) return { ok: false, status: 401, error: "Missing Authorization: Bearer <api-key> header." };

  const keys = await prisma.apiKey.findMany({ where: { revoked: false } });
  const match = keys.find((k) => verifyToken(providedKey, k.keyHash));
  if (!match) return { ok: false, status: 401, error: "Invalid or revoked API key." };

  await prisma.apiKey.update({ where: { id: match.id }, data: { lastUsedAt: new Date() } });
  return { ok: true };
}

export { hashToken };
