import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface Bucket {
  date: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  toolCalls: number;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Real time series bucketed by day over real timestamps: tokens/cost from
// ExecutionRun.startedAt (SubAgentStep has no timestamp of its own), tool
// calls from ToolCallLog.createdAt. Bucketed in JS rather than a raw
// date_trunc query - this app's real data volume is small enough that a
// second query-shape (raw SQL through the Neon driver adapter) isn't worth
// the added risk for the same real result.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const [executions, toolCalls] = await Promise.all([
    prisma.executionRun.findMany({
      select: { startedAt: true, totalInputTokens: true, totalOutputTokens: true, totalCostUsd: true },
    }),
    prisma.toolCallLog.findMany({ select: { createdAt: true } }),
  ]);

  const buckets: Record<string, Bucket> = {};
  function bucketFor(date: Date): Bucket {
    const key = dayKey(date);
    buckets[key] ??= { date: key, inputTokens: 0, outputTokens: 0, costUsd: 0, toolCalls: 0 };
    return buckets[key];
  }

  for (const run of executions) {
    const b = bucketFor(run.startedAt);
    b.inputTokens += run.totalInputTokens;
    b.outputTokens += run.totalOutputTokens;
    b.costUsd += run.totalCostUsd;
  }
  for (const log of toolCalls) {
    bucketFor(log.createdAt).toolCalls += 1;
  }

  const series = Object.values(buckets).sort((a, b) => (a.date < b.date ? -1 : 1));

  return Response.json({ series });
}
