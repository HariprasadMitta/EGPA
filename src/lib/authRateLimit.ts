import Redis from "ioredis";

// Real Redis-backed rate limiting for auth endpoints (signup, credentials
// login) - the in-memory limiter in rateLimit.ts resets per-instance, which
// is an accepted tradeoff for the public recommendation demo but not
// acceptable for brute-force protection on login: a serverless platform can
// route retries to a fresh instance constantly, making an in-memory counter
// nearly useless as a security control. Reuses the same REDIS_URL as
// eventBus.ts/presence.ts, cached on globalThis for the same hot-reload
// reason as those modules.
const WINDOW_SECONDS = 15 * 60;

const globalForAuthLimiter = globalThis as unknown as { authLimiterRedis?: Redis };

function getClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set.");
  globalForAuthLimiter.authLimiterRedis ??= new Redis(url, { tls: {}, lazyConnect: false });
  return globalForAuthLimiter.authLimiterRedis;
}

export interface AuthRateLimitResult {
  allowed: boolean;
  remaining: number;
}

// Fails open (allows the request) if Redis itself is unreachable - a rate
// limiter's own infrastructure hiccup should never become a self-inflicted
// login outage for every real user.
export async function checkAuthRateLimit(
  scope: string,
  identifier: string,
  maxAttempts: number
): Promise<AuthRateLimitResult> {
  try {
    const client = getClient();
    const key = `authlimit:${scope}:${identifier.toLowerCase()}`;
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, WINDOW_SECONDS);
    }
    return { allowed: count <= maxAttempts, remaining: Math.max(0, maxAttempts - count) };
  } catch {
    return { allowed: true, remaining: maxAttempts };
  }
}
