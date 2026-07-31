import { RiskTier, TelemetryEvent } from "@/types";

const STEP_LIBRARY: { step: string; reason: string }[] = [
  {
    step: "Parse intake payload",
    reason: "Normalized questionnaire answers and free-text description into structured fields",
  },
  {
    step: "Classify risk tier",
    reason: "Applied OSCAR scoring function against sensitivity, autonomy, and blast-radius inputs",
  },
  {
    step: "Select tool subset",
    reason: "Filtered tool catalog to entries allowed for the computed risk tier",
  },
  {
    step: "Draft recommendation",
    reason: "Called recommendation engine with use case context and risk tier",
  },
  {
    step: "Evaluate governance gate",
    reason: "Checked required controls and HITL tier against acknowledgement state",
  },
  {
    step: "Await human approval",
    reason: "Blocked on required reviewer sign-off before proceeding",
  },
  {
    step: "Assemble ADR",
    reason: "Compiled use case, tier, recommendation, and controls into versioned record",
  },
];

// mulberry32 - unlike a naive LCG, this has good avalanche behavior so
// seeds that only differ by a small amount (e.g. the same id with an
// incrementing counter appended, as the live-tick feed does) still produce
// well-decorrelated output instead of runs of repeated values.
function seededRandom(seed: number) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  // Finalizer mix (Murmur3-style) - the raw hash above is too smooth between
  // nearby inputs on its own, which is exactly what fed the bug above.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return Math.abs(hash) || 1;
}

export function generateTelemetry(
  useCaseId: string,
  riskTier: RiskTier,
  count = 12
): TelemetryEvent[] {
  const rand = seededRandom(hashString(useCaseId));
  const iterationCeiling =
    riskTier === "Critical" ? 3 : riskTier === "High" ? 5 : riskTier === "Medium" ? 8 : 12;

  const events: TelemetryEvent[] = [];
  let cursor = Date.now() - count * 45_000;

  for (let i = 0; i < count; i++) {
    const lib = STEP_LIBRARY[Math.floor(rand() * STEP_LIBRARY.length)];
    cursor += Math.floor(rand() * 20_000) + 15_000;
    events.push({
      useCaseId,
      timestamp: new Date(cursor).toISOString(),
      agentStep: lib.step,
      decisionReason: lib.reason,
      durationMs: Math.floor(rand() * 2400) + 120,
      contextTokensUsed: Math.floor(rand() * 6000) + 800,
      loopIteration: (i % iterationCeiling) + 1,
    });
  }

  return events;
}

export function driftIndicator(seed: string): number {
  const rand = seededRandom(hashString(seed + "drift"));
  return Math.round(rand() * 18 * 10) / 10;
}

export function costValueGauge(seed: string): { costUsd: number; valueScore: number } {
  const rand = seededRandom(hashString(seed + "cost"));
  return {
    costUsd: Math.round(rand() * 40 * 100) / 100 + 2,
    valueScore: Math.round((rand() * 30 + 65) * 10) / 10,
  };
}

export function contextUsage(seed: string): { usedTokens: number; budgetTokens: number } {
  const rand = seededRandom(hashString(seed + "ctx"));
  const budgetTokens = 200_000;
  const usedTokens = Math.floor(rand() * budgetTokens * 0.7) + budgetTokens * 0.05;
  return { usedTokens: Math.floor(usedTokens), budgetTokens };
}
