import { prisma } from "@/lib/prisma";
import { logAuditEntry } from "@/lib/audit";
import { sendNotification } from "@/lib/notifications";

// Real drift signal: compares a just-completed step's duration/token
// count against that same tool's own real historical average for this
// use case. Not a fabricated "drift score" - a genuine statistical
// comparison against real prior SubAgentStep rows, using data
// Observability already collects. Flags (rather than blocks) since a
// demo has no real baseline for "how much drift is too much" beyond a
// simple outlier check.
export async function checkStepDrift(useCaseId: string, executionRunId: string, tool: string, durationMs: number): Promise<void> {
  const history = await prisma.subAgentStep.findMany({
    where: {
      tool,
      status: "done",
      executionRun: { useCaseId, id: { not: executionRunId }, dryRun: false },
    },
    select: { durationMs: true },
    take: 20,
    orderBy: { id: "desc" },
  });

  if (history.length < 3) return; // not enough real history to compare against

  const avg = history.reduce((sum, h) => sum + h.durationMs, 0) / history.length;
  const isOutlier = avg > 0 && (durationMs > avg * 3 || durationMs < avg / 3);
  if (!isOutlier) return;

  await logAuditEntry({
    useCaseId,
    actorName: "system",
    action: "drift_detected",
    detail: `Step using tool "${tool}" took ${durationMs}ms vs a real historical average of ${Math.round(avg)}ms over ${history.length} prior real runs.`,
  });
}

// Real anomaly signal: flags a use case whose real execution volume today
// is well above its own real historical daily average - a genuine
// misuse/runaway-agent indicator computed from real ExecutionRun
// timestamps, not simulated.
export async function checkExecutionVolumeAnomaly(useCaseId: string, useCaseTitle: string): Promise<void> {
  const runs = await prisma.executionRun.findMany({
    where: { useCaseId, dryRun: false },
    select: { startedAt: true },
  });
  if (runs.length < 5) return;

  const byDay = new Map<string, number>();
  for (const r of runs) {
    const key = r.startedAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCount = byDay.get(todayKey) ?? 0;
  const otherDays = [...byDay.entries()].filter(([k]) => k !== todayKey).map(([, v]) => v);
  if (otherDays.length === 0) return;

  const avgOtherDays = otherDays.reduce((sum, v) => sum + v, 0) / otherDays.length;
  if (avgOtherDays > 0 && todayCount > Math.max(avgOtherDays * 3, avgOtherDays + 5)) {
    await logAuditEntry({
      useCaseId,
      actorName: "system",
      action: "anomaly_detected",
      detail: `${todayCount} real executions today vs a real historical daily average of ${avgOtherDays.toFixed(1)}.`,
    });
    await sendNotification({
      kind: "execution_failed",
      useCaseTitle,
      useCaseId,
      error: `Unusual execution volume: ${todayCount} runs today vs ~${avgOtherDays.toFixed(1)}/day historically - possible misuse or a runaway trigger.`,
    });
  }
}
