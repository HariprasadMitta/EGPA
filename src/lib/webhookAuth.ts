import { createHash, randomBytes, timingSafeEqual } from "crypto";

// A real bearer-token scheme for the webhook trigger route (src/app/api/webhooks/executions/[useCaseId]/route.ts) -
// there's no browser session for a cron job or external caller to send, so
// this is deliberately separate from src/auth.ts's cookie/JWT session auth.
// Only the hash is ever persisted (WebhookTrigger.tokenHash); the plaintext
// token is generated here and shown to the user exactly once.

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyToken(providedToken: string, storedHash: string): boolean {
  const providedHash = hashToken(providedToken);
  const a = Buffer.from(providedHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
