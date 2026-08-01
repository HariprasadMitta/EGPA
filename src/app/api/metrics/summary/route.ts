import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Cross-portfolio Observability aggregates - real Prisma reads across every
// ExecutionRun/SubAgentStep/ToolCallLog the signed-in user can see (shared
// visibility, same as Portfolio). Computed in one pass over the real rows
// rather than several separate aggregate queries, so every number here is
// guaranteed internally consistent.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const executions = await prisma.executionRun.findMany({
    include: {
      steps: true,
      toolCallLogs: true,
      useCase: { select: { riskTier: true } },
    },
  });

  let totalSteps = 0;
  let totalToolCalls = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;
  let doneStepCount = 0;
  let errorStepCount = 0;
  let doneDurationSum = 0;

  const byModel: Record<
    string,
    { count: number; inputTokens: number; outputTokens: number; costUsd: number; durationMsSum: number }
  > = {};
  const byTool: Record<string, number> = {};
  const byRiskTier: Record<string, { executions: number; tokens: number; costUsd: number }> = {};

  // Real RAG metrics parsed from ToolCallLog.result - knowledgeBaseSearch
  // (src/lib/knowledgeBase.ts) either returns "No relevant documents
  // found..." (a miss) or one or more real "[relevance 0.87] ..." lines from
  // an actual Pinecone match (a hit). Parsing the persisted result string
  // rather than adding a schema field: the relevance score was already real
  // and already stored, just not surfaced anywhere.
  let ragSearches = 0;
  let ragHits = 0;
  let ragRelevanceSum = 0;
  let ragRelevanceCount = 0;

  for (const run of executions) {
    totalInputTokens += run.totalInputTokens;
    totalOutputTokens += run.totalOutputTokens;
    totalCostUsd += run.totalCostUsd;
    totalToolCalls += run.toolCallLogs.length;

    const tier = run.useCase.riskTier;
    byRiskTier[tier] ??= { executions: 0, tokens: 0, costUsd: 0 };
    byRiskTier[tier].executions += 1;
    byRiskTier[tier].tokens += run.totalInputTokens + run.totalOutputTokens;
    byRiskTier[tier].costUsd += run.totalCostUsd;

    for (const step of run.steps) {
      totalSteps += 1;
      if (step.status === "done") {
        doneStepCount += 1;
        doneDurationSum += step.durationMs;
      } else if (step.status === "error") {
        errorStepCount += 1;
      }
      if (step.provider) {
        byModel[step.provider] ??= { count: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, durationMsSum: 0 };
        byModel[step.provider].count += 1;
        byModel[step.provider].inputTokens += step.inputTokens;
        byModel[step.provider].outputTokens += step.outputTokens;
        byModel[step.provider].costUsd += step.costUsd;
        byModel[step.provider].durationMsSum += step.durationMs;
      }
    }

    for (const log of run.toolCallLogs) {
      byTool[log.toolName] = (byTool[log.toolName] ?? 0) + 1;

      if (log.toolName === "knowledge_base_search") {
        ragSearches += 1;
        const isHit = !log.result.startsWith("No relevant documents found");
        if (isHit) {
          ragHits += 1;
          const match = log.result.match(/relevance ([\d.]+)/);
          if (match) {
            ragRelevanceSum += Number(match[1]);
            ragRelevanceCount += 1;
          }
        }
      }
    }
  }

  const settledSteps = doneStepCount + errorStepCount;

  const byModelWithAvg = Object.fromEntries(
    Object.entries(byModel).map(([provider, m]) => [
      provider,
      { ...m, avgDurationMs: Math.round(m.durationMsSum / m.count) },
    ])
  );

  return Response.json({
    totalExecutions: executions.length,
    totalSteps,
    totalToolCalls,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
    successRate: settledSteps > 0 ? doneStepCount / settledSteps : null,
    avgStepDurationMs: doneStepCount > 0 ? Math.round(doneDurationSum / doneStepCount) : 0,
    byModel: byModelWithAvg,
    byTool,
    byRiskTier,
    ragMetrics: {
      totalSearches: ragSearches,
      hits: ragHits,
      misses: ragSearches - ragHits,
      hitRate: ragSearches > 0 ? ragHits / ragSearches : null,
      avgTopRelevance: ragRelevanceCount > 0 ? ragRelevanceSum / ragRelevanceCount : null,
    },
  });
}
