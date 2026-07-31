const WINDOW_MS = 60 * 60 * 1000;

function prune(hits: number[], now: number): number[] {
  return hits.filter((t) => now - t < WINDOW_MS);
}

/**
 * In-memory only: resets on cold start / per-instance. Accepted tradeoff for
 * an unmonitored public demo link with no database - see recommend/route.ts.
 */
export function createRateLimiter(maxPerIp: number, maxGlobalPerHour: number) {
  const ipHits = new Map<string, number[]>();
  let globalHits: number[] = [];

  return {
    check(ip: string): { allowed: boolean; remaining: number; reason?: string } {
      const now = Date.now();
      globalHits = prune(globalHits, now);
      const current = prune(ipHits.get(ip) ?? [], now);
      ipHits.set(ip, current);

      if (globalHits.length >= maxGlobalPerHour) {
        return { allowed: false, remaining: 0, reason: "Demo is at capacity for this hour. Please try again later." };
      }
      if (current.length >= maxPerIp) {
        return {
          allowed: false,
          remaining: 0,
          reason: `You've used your ${maxPerIp} free requests for this hour. Please try again later.`,
        };
      }
      return { allowed: true, remaining: maxPerIp - current.length };
    },
    record(ip: string) {
      const now = Date.now();
      globalHits.push(now);
      const current = ipHits.get(ip) ?? [];
      current.push(now);
      ipHits.set(ip, current);
    },
  };
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}
