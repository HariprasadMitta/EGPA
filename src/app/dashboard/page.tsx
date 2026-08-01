"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { canAccessDeveloperTools } from "@/lib/roles";
import { useStore } from "@/lib/store";
import { useMlOps } from "@/lib/mlops";
import { RiskBadge } from "@/components/RiskBadge";
import { HorizontalBarChart, riskTierColor, SparkLineChart, StatTile } from "@/components/charts";
import { ExecutionRun, PingResult, RiskTier, SubAgentStep } from "@/types";

interface MetricsSummary {
  totalExecutions: number;
  totalSteps: number;
  totalToolCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  successRate: number | null;
  avgStepDurationMs: number;
  byModel: Record<string, { count: number; inputTokens: number; outputTokens: number; costUsd: number }>;
  byTool: Record<string, number>;
  byRiskTier: Record<string, { executions: number; tokens: number; costUsd: number }>;
}

interface TimeseriesPoint {
  date: string;
  tokens: number;
  costUsd: number;
  toolCalls: number;
}

interface PortfolioToolCallLog {
  id: string;
  stepId: string;
  toolName: string;
  argsJson: string;
  result: string;
  createdAt: string;
}

interface PortfolioExecution extends ExecutionRun {
  useCaseTitle: string;
  riskTier: RiskTier;
  toolCallLogs: PortfolioToolCallLog[];
}

function ConnectionStatusRow({
  label,
  connected,
  detail,
  ping,
}: {
  label: string;
  connected: boolean;
  detail: string | null;
  ping: PingResult | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] py-3 last:border-0">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-[var(--muted)]">
          {connected ? detail || "Connected" : "Not connected"}
        </p>
      </div>
      {connected && ping ? (
        <span
          className={`text-xs font-medium ${ping.ok ? "text-[var(--status-done)]" : "text-[var(--tier-critical)]"}`}
        >
          {ping.ok ? `OK - ${ping.latencyMs}ms` : `Failed - ${ping.message ?? "error"}`}
          <span className="ml-1 text-[var(--muted)]" suppressHydrationWarning>
            ({new Date(ping.checkedAt).toLocaleTimeString("en-US")})
          </span>
        </span>
      ) : (
        <span className="text-xs text-[var(--muted)]">{connected ? "Not pinged yet" : "-"}</span>
      )}
    </div>
  );
}

function ExecutionHistoryRow({ execution }: { execution: PortfolioExecution }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <RiskBadge tier={execution.riskTier} />
          <span className="text-sm font-semibold">{execution.useCaseTitle}</span>
          <span className="text-xs text-[var(--muted)]">run #{execution.runNumber}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <span className="capitalize">{execution.status}</span>
          <span>{(execution.totalInputTokens + execution.totalOutputTokens).toLocaleString("en-US")} tok</span>
          <span>${execution.totalCostUsd.toFixed(4)}</span>
          <span suppressHydrationWarning>{new Date(execution.startedAt).toLocaleString("en-US")}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="space-y-3 border-t border-[var(--border)] px-4 py-3">
          {execution.steps.map((step) => (
            <div key={step.id} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{step.name}</span>
                <span className="text-xs text-[var(--muted)]">
                  {step.provider ?? "-"} &middot; {step.durationMs}ms &middot; ${step.costUsd.toFixed(4)} &middot;{" "}
                  {step.toolCallCount} tool call{step.toolCallCount === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-xs text-[var(--muted)]">{step.tool} &middot; {step.task}</p>
              {step.output && <p className="mt-1 text-xs">{step.output}</p>}
            </div>
          ))}
          {execution.toolCallLogs.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Real tool call log ({execution.toolCallLogs.length})
              </p>
              <div className="mt-2 space-y-2">
                {execution.toolCallLogs.map((log) => (
                  <div key={log.id} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-semibold">{log.toolName}</span>
                      <span className="text-[var(--muted)]" suppressHydrationWarning>
                        {log.stepId} &middot; {new Date(log.createdAt).toLocaleTimeString("en-US")}
                      </span>
                    </div>
                    <p className="mt-1 text-[var(--muted)]">args: {log.argsJson}</p>
                    <p className="mt-1">{log.result}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PortfolioObservability() {
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [series, setSeries] = useState<TimeseriesPoint[]>([]);
  const [executions, setExecutions] = useState<PortfolioExecution[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [summaryRes, seriesRes, execRes] = await Promise.all([
        fetch("/api/metrics/summary"),
        fetch("/api/metrics/timeseries"),
        fetch("/api/metrics/executions"),
      ]);
      if (cancelled) return;
      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (seriesRes.ok) setSeries((await seriesRes.json()).series);
      if (execRes.ok) setExecutions((await execRes.json()).executions);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="mt-8 text-sm text-[var(--muted)]">Loading real cross-portfolio metrics...</p>;
  }
  if (!summary) {
    return <p className="mt-8 text-sm text-[var(--muted)]">Could not load portfolio metrics.</p>;
  }

  const modelBars = Object.entries(summary.byModel)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([provider, v]) => ({ label: provider, value: v.count }));
  const toolBars = Object.entries(summary.byTool)
    .sort(([, a], [, b]) => b - a)
    .map(([tool, count]) => ({ label: tool, value: count }));
  const tierOrder = ["Low", "Medium", "High", "Critical"];
  const tierBars = tierOrder
    .filter((t) => summary.byRiskTier[t])
    .map((t) => ({ label: t, value: summary.byRiskTier[t].costUsd }));

  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold text-[var(--brand-strong)]">
        Portfolio-wide metrics &mdash; every real execution, every use case
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Real Prisma aggregates across everything this account can see, same shared visibility as
        Portfolio &mdash; not just the one use case selected below.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total executions" value={summary.totalExecutions.toLocaleString("en-US")} />
        <StatTile label="Total steps" value={summary.totalSteps.toLocaleString("en-US")} />
        <StatTile label="Total real tool calls" value={summary.totalToolCalls.toLocaleString("en-US")} />
        <StatTile
          label="Total tokens (in / out)"
          value={`${summary.totalInputTokens.toLocaleString("en-US")} / ${summary.totalOutputTokens.toLocaleString("en-US")}`}
        />
        <StatTile label="Total real cost" value={`$${summary.totalCostUsd.toFixed(4)}`} />
        <StatTile
          label="Success rate"
          value={summary.successRate !== null ? `${(summary.successRate * 100).toFixed(0)}%` : "-"}
          sub="of settled steps"
        />
        <StatTile
          label="Avg step duration"
          value={summary.avgStepDurationMs > 0 ? `${(summary.avgStepDurationMs / 1000).toFixed(1)}s` : "-"}
        />
      </div>

      {series.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Tokens / day</h3>
            <div className="mt-2">
              <SparkLineChart data={series.map((s) => ({ date: s.date, value: s.tokens }))} color="var(--series-1)" />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Cost (USD) / day</h3>
            <div className="mt-2">
              <SparkLineChart
                data={series.map((s) => ({ date: s.date, value: s.costUsd }))}
                color="var(--series-2)"
                valueFormatter={(v) => `$${v.toFixed(4)}`}
              />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Tool calls / day</h3>
            <div className="mt-2">
              <SparkLineChart data={series.map((s) => ({ date: s.date, value: s.toolCalls }))} color="var(--series-3)" />
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">By model (steps)</h3>
          <div className="mt-3">
            <HorizontalBarChart data={modelBars} />
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">By tool (real calls)</h3>
          <div className="mt-3">
            <HorizontalBarChart data={toolBars} />
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">By risk tier (cost)</h3>
          <div className="mt-3">
            <HorizontalBarChart
              data={tierBars}
              valueFormatter={(v) => `$${v.toFixed(4)}`}
              colorFor={(label) => riskTierColor(label)}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <button type="button" onClick={() => setHistoryOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Execution history, every use case ({executions.length}) &mdash; click a run to expand
          </h3>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-4 w-4 flex-none transition-transform ${historyOpen ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {historyOpen && (
          <div className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto">
            {executions.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No executions run yet across the portfolio.</p>
            ) : (
              executions.map((execution) => <ExecutionHistoryRow key={execution.id} execution={execution} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { bundles, active } = useStore();
  const mlops = useMlOps();
  const selected = active ?? bundles[0] ?? null;

  const allSteps: { run: ExecutionRun; step: SubAgentStep }[] = selected
    ? selected.executions.flatMap((run) =>
        run.steps
          .filter((s) => s.status === "done" || s.status === "error")
          .map((step) => ({ run, step }))
      )
    : [];

  const doneSteps = allSteps.filter(({ step }) => step.status === "done");
  const avgDurationMs = doneSteps.length
    ? Math.round(doneSteps.reduce((sum, { step }) => sum + step.durationMs, 0) / doneSteps.length)
    : 0;
  const providerCounts = doneSteps.reduce<Record<string, number>>((acc, { step }) => {
    const p = step.provider ?? "unknown";
    acc[p] = (acc[p] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-strong)]">
            Observability
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Real usage, cost, and step-level history, measured directly from executions run in
            this app &mdash; nothing on this page is simulated.
          </p>
        </div>
      </div>

      <PortfolioObservability />

      {user && canAccessDeveloperTools(user.role) && (
        <div className="mt-8 rounded-xl border border-[var(--status-done)]/30 bg-[var(--surface)] p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--status-done)]">
            Model Builder connections &mdash; real, live status checks
          </h3>
          <div className="mt-2">
            <ConnectionStatusRow
              label="OpenRouter (off-the-shelf models)"
              connected={mlops.openRouter.connected}
              detail={mlops.openRouter.selectedModel}
              ping={mlops.pings.openRouter}
            />
            <ConnectionStatusRow
              label="Hugging Face (custom models)"
              connected={mlops.huggingFace.connected}
              detail={
                mlops.huggingFace.selectedModel
                  ? `${mlops.huggingFace.selectedModel}${mlops.huggingFace.username ? ` · ${mlops.huggingFace.username}` : ""}`
                  : mlops.huggingFace.username
              }
              ping={mlops.pings.huggingFace}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            {mlops.ragChunks.length} RAG chunk{mlops.ragChunks.length === 1 ? "" : "s"} stored this
            session &middot; manage connections and run pings from Model Builder.
          </p>
        </div>
      )}

      <h2 className="mt-10 text-lg font-bold text-[var(--brand-strong)]">
        Selected use case detail
      </h2>

      {!selected ? (
        <p className="mt-4 text-[var(--muted)]">No use case selected.</p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            <h3 className="font-semibold">{selected.useCase.title}</h3>
            <RiskBadge tier={selected.useCase.riskTier} />
          </div>

          {selected.executions.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--muted)]">
              No executions run yet for this use case &mdash; run one from the Execute page to
              populate real usage and step history here.
            </p>
          ) : (
            (() => {
              const latest = selected.executions[selected.executions.length - 1];
              const lifetimeTokens = selected.executions.reduce(
                (sum, e) => sum + e.totalInputTokens + e.totalOutputTokens,
                0
              );
              const lifetimeCost = selected.executions.reduce((sum, e) => sum + e.totalCostUsd, 0);
              return (
                <>
                  <div className="mt-6 rounded-xl border border-[var(--accent)]/30 bg-[var(--surface)] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                        Real execution usage
                      </h3>
                      <span className="text-xs text-[var(--muted)]">
                        {selected.executions.length} execution{selected.executions.length === 1 ? "" : "s"} &middot;
                        latest: <span className="font-mono">{latest.id}</span> (run #{latest.runNumber},{" "}
                        <span className="capitalize">{latest.status}</span>)
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-[var(--muted)]">Latest run tokens</p>
                        <p className="text-lg font-bold">
                          {(latest.totalInputTokens + latest.totalOutputTokens).toLocaleString("en-US")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)]">Latest run cost</p>
                        <p className="text-lg font-bold">${latest.totalCostUsd.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)]">Lifetime tokens / cost</p>
                        <p className="text-lg font-bold">
                          {lifetimeTokens.toLocaleString("en-US")} / ${lifetimeCost.toFixed(4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)]">Avg sub-agent step duration</p>
                        <p className="text-lg font-bold">
                          {avgDurationMs > 0 ? `${(avgDurationMs / 1000).toFixed(1)}s` : "-"}
                        </p>
                      </div>
                    </div>
                    {Object.keys(providerCounts).length > 0 && (
                      <p className="mt-3 text-xs text-[var(--muted)]">
                        Provider mix:{" "}
                        {Object.entries(providerCounts)
                          .map(([p, c]) => `${p} (${c})`)
                          .join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Decision trace &mdash; real step history, every execution
                    </h2>
                    <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
                      {[...allSteps].reverse().map(({ run, step }) => (
                        <div
                          key={`${run.id}-${step.id}`}
                          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold">{step.name}</span>
                            <span
                              className={`text-xs ${step.status === "error" ? "text-[var(--tier-critical)]" : "text-[var(--muted)]"}`}
                            >
                              run #{run.runNumber} &middot; {step.durationMs}ms &middot;{" "}
                              {(step.inputTokens + step.outputTokens).toLocaleString("en-US")} tok
                            </span>
                          </div>
                          <p className="text-[var(--muted)]">
                            {step.tool} &middot; {step.task}
                          </p>
                          {step.output && <p className="mt-1">{step.output}</p>}
                          <p className="mt-2 text-xs text-[var(--muted)]">
                            {step.provider ?? "-"} &middot; ${step.costUsd.toFixed(4)} &middot;{" "}
                            {step.toolCallCount} real tool call{step.toolCallCount === 1 ? "" : "s"}{" "}
                            (audit-logged)
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()
          )}
        </>
      )}
    </div>
  );
}
