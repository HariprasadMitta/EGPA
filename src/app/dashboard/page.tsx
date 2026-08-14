"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { canAccessDeveloperTools } from "@/lib/roles";
import { useStore } from "@/lib/store";
import { useMlOps } from "@/lib/mlops";
import { RiskBadge } from "@/components/RiskBadge";
import {
  ChartLegend,
  HorizontalBarChart,
  riskTierColor,
  SparkLineChart,
  StackedAreaChart,
  StatTile,
  TimeRangeControls,
  TimeRangeKey,
  filterByRange,
} from "@/components/charts";
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
  byModel: Record<
    string,
    { count: number; inputTokens: number; outputTokens: number; costUsd: number; avgDurationMs: number }
  >;
  byTool: Record<string, number>;
  byRiskTier: Record<string, { executions: number; tokens: number; costUsd: number }>;
  ragMetrics: {
    totalSearches: number;
    hits: number;
    misses: number;
    hitRate: number | null;
    avgTopRelevance: number | null;
  };
}

interface SystemMetrics {
  tables: Record<string, number>;
  governance: {
    gatesAcknowledged: number;
    gatesTotal: number;
    arbApprovals: number;
    killSwitchesEngaged: number;
  };
  webhooks: {
    configured: number;
    enabled: number;
    totalRealTriggers: number;
    lastTriggeredAt: string | null;
  };
  users: {
    total: number;
    mostRecentSignupAt: string | null;
  };
}

interface NeonMetrics {
  configured: boolean;
  error?: string;
  databaseSizeBytes: number | null;
  computeState: string | null;
  minCu: number | null;
  maxCu: number | null;
  autosuspendSeconds: number | null;
  lastActiveAt: string | null;
  cpuUsedSec: number | null;
  activeTimeSeconds: number | null;
  dataTransferBytes: number | null;
  writtenDataBytes: number | null;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "-";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

// ~4GB RAM per CU, matching Neon's own "0.25 CU (~1 GB RAM)" display
// convention on their real Monitoring page.
function cuToRamLabel(cu: number): string {
  return `${cu} CU (~${cu * 4} GB RAM)`;
}

interface TimeseriesPoint {
  date: string;
  inputTokens: number;
  outputTokens: number;
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
          {execution.steps.map((step, i) => {
            const previous = i > 0 ? execution.steps[i - 1] : null;
            return (
              <div key={step.id} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{step.name}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {step.provider ?? "-"} &middot; {step.durationMs}ms &middot; ${step.costUsd.toFixed(4)} &middot;{" "}
                    {step.toolCallCount} tool call{step.toolCallCount === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)]">{step.tool} &middot; {step.task}</p>
                {step.rationale && (
                  <p className="mt-1.5 text-xs text-[var(--accent)]">
                    <span className="font-semibold">Why this tool: </span>
                    {step.rationale}
                  </p>
                )}
                {previous?.output && (
                  <p className="mt-1.5 text-xs text-[var(--muted)]">
                    <span className="font-semibold text-[var(--foreground)]">Received from &quot;{previous.name}&quot;: </span>
                    {previous.output}
                  </p>
                )}
                {step.output && <p className="mt-1 text-xs">{step.output}</p>}
              </div>
            );
          })}
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
  const [system, setSystem] = useState<SystemMetrics | null>(null);
  const [neon, setNeon] = useState<NeonMetrics | null>(null);
  const [series, setSeries] = useState<TimeseriesPoint[]>([]);
  const [executions, setExecutions] = useState<PortfolioExecution[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<TimeRangeKey>("all");

  // Summary is fetched separately (with the current range) so the stat
  // tiles actually update when the range picker changes - the other four
  // fetches below are range-independent (system/Neon are current-state
  // snapshots, series/executions carry their own real timestamps and are
  // filtered client-side).
  async function loadSummary(r: TimeRangeKey) {
    const res = await fetch(`/api/metrics/summary?range=${r}`);
    if (res.ok) setSummary(await res.json());
  }

  async function loadRest() {
    const [systemRes, neonRes, seriesRes, execRes] = await Promise.all([
      fetch("/api/metrics/system"),
      fetch("/api/metrics/neon"),
      fetch("/api/metrics/timeseries"),
      fetch("/api/metrics/executions"),
    ]);
    if (systemRes.ok) setSystem(await systemRes.json());
    if (neonRes.ok) setNeon(await neonRes.json());
    if (seriesRes.ok) setSeries((await seriesRes.json()).series);
    if (execRes.ok) setExecutions((await execRes.json()).executions);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([loadSummary(range), loadRest()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skips its own first run - the mount effect above already fetches the
  // initial range's summary, so this only re-fetches on later range changes.
  const rangeEffectSkippedFirstRun = useRef(false);
  useEffect(() => {
    if (!rangeEffectSkippedFirstRun.current) {
      rangeEffectSkippedFirstRun.current = true;
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/metrics/summary?range=${range}`);
      if (res.ok && !cancelled) setSummary(await res.json());
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([loadSummary(range), loadRest()]);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return <p className="mt-8 text-sm text-[var(--muted)]">Loading real cross-portfolio metrics...</p>;
  }
  if (!summary || !system) {
    return <p className="mt-8 text-sm text-[var(--muted)]">Could not load portfolio metrics.</p>;
  }

  const visibleSeries = filterByRange(series, range);
  const modelRows = Object.entries(summary.byModel).sort(([, a], [, b]) => b.count - a.count);
  const toolBars = Object.entries(summary.byTool)
    .sort(([, a], [, b]) => b - a)
    .map(([tool, count]) => ({ label: tool, value: count }));
  const tierOrder = ["Low", "Medium", "High", "Critical"];
  const tierCostBars = tierOrder
    .filter((t) => summary.byRiskTier[t])
    .map((t) => ({ label: t, value: summary.byRiskTier[t].costUsd }));
  const tierTokenBars = tierOrder
    .filter((t) => summary.byRiskTier[t])
    .map((t) => ({ label: t, value: summary.byRiskTier[t].tokens }));
  const totalRows = Object.values(system.tables).reduce((sum, n) => sum + n, 0);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--brand-strong)]">
            Portfolio-wide metrics &mdash; every real execution, every use case
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Real Prisma aggregates across everything this account can see, same shared visibility as
            Portfolio &mdash; not just the one use case selected below.
          </p>
        </div>
        <TimeRangeControls value={range} onChange={setRange} onRefresh={handleRefresh} refreshing={refreshing} />
      </div>

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
          tone={
            summary.successRate === null
              ? undefined
              : summary.successRate >= 0.9
                ? "good"
                : summary.successRate >= 0.7
                  ? "warning"
                  : "critical"
          }
        />
        <StatTile
          label="Avg step duration"
          value={summary.avgStepDurationMs > 0 ? `${(summary.avgStepDurationMs / 1000).toFixed(1)}s` : "-"}
        />
        <StatTile
          label="Kill-switches engaged"
          value={system.governance.killSwitchesEngaged.toLocaleString("en-US")}
          tone={system.governance.killSwitchesEngaged > 0 ? "warning" : "good"}
        />
      </div>

      {visibleSeries.length > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:col-span-1">
            <ChartLegend
              caption="Tokens"
              items={[
                { label: "Input", color: "var(--series-1)" },
                { label: "Output", color: "var(--series-2)" },
              ]}
            />
            <div className="mt-2">
              <StackedAreaChart
                data={visibleSeries.map((s) => ({ date: s.date, values: { input: s.inputTokens, output: s.outputTokens } }))}
                seriesKeys={[
                  { key: "input", label: "Input", color: "var(--series-1)" },
                  { key: "output", label: "Output", color: "var(--series-2)" },
                ]}
              />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <ChartLegend caption="Cost (USD)" items={[{ label: "Real spend", color: "var(--series-3)" }]} />
            <div className="mt-2">
              <SparkLineChart
                data={visibleSeries.map((s) => ({ date: s.date, value: s.costUsd }))}
                color="var(--series-3)"
                valueFormatter={(v) => `$${v.toFixed(4)}`}
              />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <ChartLegend caption="Tool calls" items={[{ label: "Knowledge base + others", color: "var(--series-4)" }]} />
            <div className="mt-2">
              <SparkLineChart data={visibleSeries.map((s) => ({ date: s.date, value: s.toolCalls }))} color="var(--series-4)" />
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              data={tierCostBars}
              valueFormatter={(v) => `$${v.toFixed(4)}`}
              colorFor={(label) => riskTierColor(label)}
            />
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">By risk tier (tokens)</h3>
          <div className="mt-3">
            <HorizontalBarChart data={tierTokenBars} colorFor={(label) => riskTierColor(label)} />
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">RAG (Pinecone + Cohere)</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Real searches</span>
              <span className="font-semibold">{summary.ragMetrics.totalSearches}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Hit rate</span>
              <span className="font-semibold">
                {summary.ragMetrics.hitRate !== null ? `${(summary.ragMetrics.hitRate * 100).toFixed(0)}%` : "-"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Misses</span>
              <span className="font-semibold">{summary.ragMetrics.misses}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Avg top relevance</span>
              <span className="font-semibold">
                {summary.ragMetrics.avgTopRelevance !== null ? summary.ragMetrics.avgTopRelevance.toFixed(2) : "-"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Model metrics (real, per provider)</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                <th className="py-1.5 pr-3 font-semibold uppercase tracking-wide">Model</th>
                <th className="py-1.5 pr-3 font-semibold uppercase tracking-wide">Steps</th>
                <th className="py-1.5 pr-3 font-semibold uppercase tracking-wide">Avg latency</th>
                <th className="py-1.5 pr-3 font-semibold uppercase tracking-wide">Tokens (in/out)</th>
                <th className="py-1.5 pr-3 font-semibold uppercase tracking-wide">Total cost</th>
                <th className="py-1.5 font-semibold uppercase tracking-wide">Avg cost/step</th>
              </tr>
            </thead>
            <tbody>
              {modelRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-3 text-[var(--muted)]">
                    No real steps yet.
                  </td>
                </tr>
              ) : (
                modelRows.map(([provider, m]) => (
                  <tr key={provider} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-1.5 pr-3 font-mono">{provider}</td>
                    <td className="py-1.5 pr-3">{m.count}</td>
                    <td className="py-1.5 pr-3">{(m.avgDurationMs / 1000).toFixed(1)}s</td>
                    <td className="py-1.5 pr-3">
                      {m.inputTokens.toLocaleString("en-US")} / {m.outputTokens.toLocaleString("en-US")}
                    </td>
                    <td className="py-1.5 pr-3">${m.costUsd.toFixed(4)}</td>
                    <td className="py-1.5">${(m.costUsd / m.count).toFixed(4)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Neon database &mdash; real, live from the Neon Monitoring API
        </h3>
        {!neon || !neon.configured ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Not configured yet &mdash; add <code className="font-mono">NEON_API_KEY</code> and{" "}
            <code className="font-mono">NEON_PROJECT_ID</code> to see this project&apos;s real compute state,
            CU limits, storage, and cumulative usage.
          </p>
        ) : neon.error ? (
          <p className="mt-2 text-sm text-[var(--tier-critical)]">{neon.error}</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-[16rem_1fr]">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Compute settings</p>
              <div className="mt-2 space-y-2 text-sm">
                <div>
                  <p className="text-xs text-[var(--muted)]">Status</p>
                  <p className="font-semibold capitalize">
                    <span
                      className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
                        neon.computeState === "active" ? "bg-[var(--status-done)]" : "bg-[var(--muted)]"
                      }`}
                    />
                    {neon.computeState ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Min</p>
                  <p className="font-semibold">{neon.minCu !== null ? cuToRamLabel(neon.minCu) : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Max</p>
                  <p className="font-semibold">{neon.maxCu !== null ? cuToRamLabel(neon.maxCu) : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Autosuspend delay</p>
                  <p className="font-semibold">
                    {neon.autosuspendSeconds === 0
                      ? "5 minutes (default)"
                      : neon.autosuspendSeconds !== null
                        ? formatDuration(neon.autosuspendSeconds)
                        : "-"}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label="Database size" value={formatBytes(neon.databaseSizeBytes)} />
              <StatTile label="Cumulative compute time" value={formatDuration(neon.cpuUsedSec)} />
              <StatTile label="Cumulative active time" value={formatDuration(neon.activeTimeSeconds)} />
              <StatTile label="Data transferred" value={formatBytes(neon.dataTransferBytes)} />
              <StatTile label="Data written" value={formatBytes(neon.writtenDataBytes)} />
              <StatTile
                label="Last active"
                value={neon.lastActiveAt ? new Date(neon.lastActiveAt).toLocaleString("en-US") : "-"}
              />
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-[var(--muted)]">
          Real compute/storage totals from Neon&apos;s public API. Live RAM/CPU percentage time series (like Neon&apos;s
          own Monitoring page) come from an internal metrics API Neon doesn&apos;t expose publicly - not faked here.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Data sources &amp; API endpoints &mdash; real, live from Neon Postgres
        </h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <p className="text-xs font-semibold">AI Gateway &rarr; LiteLLM &rarr; Anthropic/OpenRouter/Groq/Gemini</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {(summary.totalSteps + summary.totalExecutions).toLocaleString("en-US")} real LLM calls
              ({summary.totalExecutions.toLocaleString("en-US")} planning + {summary.totalSteps.toLocaleString("en-US")} sub-agent)
              across {modelRows.length} provider{modelRows.length === 1 ? "" : "s"}.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <p className="text-xs font-semibold">Knowledge base &rarr; Pinecone + Cohere</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {summary.ragMetrics.totalSearches.toLocaleString("en-US")} real vector searches,{" "}
              {summary.ragMetrics.hitRate !== null ? `${(summary.ragMetrics.hitRate * 100).toFixed(0)}% hit rate` : "no calls yet"}.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <p className="text-xs font-semibold">Database &rarr; Neon Postgres</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {totalRows.toLocaleString("en-US")} real rows across {Object.keys(system.tables).length} tables.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <p className="text-xs font-semibold">Webhook triggers &rarr; external callers</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {system.webhooks.totalRealTriggers.toLocaleString("en-US")} real triggers &middot;{" "}
              {system.webhooks.enabled}/{system.webhooks.configured} use cases enabled
              {system.webhooks.lastTriggeredAt
                ? ` · last ${new Date(system.webhooks.lastTriggeredAt).toLocaleString("en-US")}`
                : ""}
              .
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <p className="text-xs font-semibold">Governance &rarr; gate/ARB/kill-switch</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {system.governance.gatesAcknowledged}/{system.governance.gatesTotal} gates cleared &middot;{" "}
              {system.governance.arbApprovals} ARB approvals &middot; {system.governance.killSwitchesEngaged} kill-switch(es) currently engaged.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <p className="text-xs font-semibold">Auth.js &rarr; real accounts</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {system.users.total.toLocaleString("en-US")} real signed-up users
              {system.users.mostRecentSignupAt
                ? ` · most recent ${new Date(system.users.mostRecentSignupAt).toLocaleDateString("en-US")}`
                : ""}
              .
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                <th className="py-1.5 pr-3 font-semibold uppercase tracking-wide">Table</th>
                <th className="py-1.5 font-semibold uppercase tracking-wide">Real row count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(system.tables).map(([table, count]) => (
                <tr key={table} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-1.5 pr-3 font-mono">{table}</td>
                  <td className="py-1.5">{count.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

  const allSteps: { run: ExecutionRun; step: SubAgentStep; previous: SubAgentStep | null }[] = selected
    ? selected.executions.flatMap((run) =>
        run.steps
          .filter((s) => s.status === "done" || s.status === "error")
          .map((step) => ({
            run,
            step,
            previous: run.steps[run.steps.findIndex((s) => s.id === step.id) - 1] ?? null,
          }))
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
                      {[...allSteps].reverse().map(({ run, step, previous }) => (
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
                          {step.rationale && (
                            <p className="mt-1.5 text-xs text-[var(--accent)]">
                              <span className="font-semibold">Why this tool: </span>
                              {step.rationale}
                            </p>
                          )}
                          {previous?.output && (
                            <p className="mt-1.5 text-xs text-[var(--muted)]">
                              <span className="font-semibold text-[var(--foreground)]">Received from &quot;{previous.name}&quot;: </span>
                              {previous.output}
                            </p>
                          )}
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
