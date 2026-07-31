"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { canAccessDeveloperTools } from "@/lib/roles";
import { useStore } from "@/lib/store";
import { useMlOps } from "@/lib/mlops";
import { RiskBadge } from "@/components/RiskBadge";
import { contextUsage, costValueGauge, driftIndicator, generateTelemetry } from "@/lib/telemetry";
import { PingResult, RiskTier, TelemetryEvent } from "@/types";

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

function TelemetryFeed({ useCaseId, riskTier }: { useCaseId: string; riskTier: RiskTier }) {
  const [events, setEvents] = useState<TelemetryEvent[]>(() =>
    generateTelemetry(useCaseId, riskTier)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setEvents((prev) => {
        const next = generateTelemetry(useCaseId + prev.length, riskTier, 1);
        return [...prev.slice(-19), ...next];
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [useCaseId, riskTier]);

  return (
    <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
      {[...events].reverse().map((event, i) => (
        <div
          key={`${event.timestamp}-${i}`}
          className="flex flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{event.agentStep}</span>
            <span className="text-xs text-[var(--muted)]">
              loop {event.loopIteration} &middot; {event.durationMs}ms &middot;{" "}
              {event.contextTokensUsed.toLocaleString("en-US")} tok
            </span>
          </div>
          <p className="text-[var(--muted)]">{event.decisionReason}</p>
          <p className="text-xs text-[var(--muted)]" suppressHydrationWarning>
            {new Date(event.timestamp).toLocaleTimeString("en-US")}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { bundles, active } = useStore();
  const mlops = useMlOps();
  const selected = active ?? bundles[0] ?? null;

  const drift = useMemo(() => (selected ? driftIndicator(selected.useCase.id) : 0), [selected]);
  const cost = useMemo(
    () => (selected ? costValueGauge(selected.useCase.id) : { costUsd: 0, valueScore: 0 }),
    [selected]
  );
  const ctx = useMemo(
    () => (selected ? contextUsage(selected.useCase.id) : { usedTokens: 0, budgetTokens: 1 }),
    [selected]
  );

  const driftLevel = drift > 12 ? "high" : drift > 6 ? "medium" : "low";
  const ctxPct = Math.round((ctx.usedTokens / ctx.budgetTokens) * 100);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-strong)]">
            Runtime Observability Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Telemetry reported up from the AI Gateway &mdash; this Control
            Plane view observes it but does not sit in the traffic path.
          </p>
        </div>
        <span className="whitespace-nowrap rounded-full border border-[var(--accent)]/30 bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
          Simulated telemetry &mdash; connects live via SDK/webhook once agents are wired up
        </span>
      </div>

      {user && canAccessDeveloperTools(user.role) && (
        <div className="mt-6 rounded-xl border border-[var(--status-done)]/30 bg-[var(--surface)] p-5">
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

      {!selected ? (
        <p className="mt-8 text-[var(--muted)]">No use case selected.</p>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-3">
            <h2 className="font-semibold">{selected.useCase.title}</h2>
            <RiskBadge tier={selected.useCase.riskTier} />
          </div>

          {selected.executions.length > 0 && (() => {
            const latest = selected.executions[selected.executions.length - 1];
            const lifetimeTokens = selected.executions.reduce(
              (sum, e) => sum + e.totalInputTokens + e.totalOutputTokens,
              0
            );
            const lifetimeCost = selected.executions.reduce((sum, e) => sum + e.totalCostUsd, 0);
            return (
              <div className="mt-6 rounded-xl border border-[var(--accent)]/30 bg-[var(--surface)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                    Real execution usage &mdash; measured, not simulated
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
                    <p className="text-xs text-[var(--muted)]">Sub-agents (latest)</p>
                    <p className="text-lg font-bold">{latest.steps.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">Lifetime tokens / cost</p>
                    <p className="text-lg font-bold">
                      {lifetimeTokens.toLocaleString("en-US")} / ${lifetimeCost.toFixed(4)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Context usage vs. budget
              </p>
              <p className="mt-2 text-2xl font-bold">{ctxPct}%</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--background)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${Math.min(ctxPct, 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {ctx.usedTokens.toLocaleString("en-US")} / {ctx.budgetTokens.toLocaleString("en-US")} tokens
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Drift indicator
              </p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  driftLevel === "high"
                    ? "text-[var(--tier-critical)]"
                    : driftLevel === "medium"
                      ? "text-[var(--tier-medium)]"
                      : "text-[var(--tier-low)]"
                }`}
              >
                {drift}%
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Deviation from baseline decision distribution ({driftLevel} drift)
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Cost vs. value
              </p>
              <p className="mt-2 text-2xl font-bold">${cost.costUsd.toFixed(2)}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Value score: {cost.valueScore}/100 this session
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Decision trace / explainability log
            </h2>
            <TelemetryFeed
              key={selected.useCase.id}
              useCaseId={selected.useCase.id}
              riskTier={selected.useCase.riskTier}
            />
          </div>
        </>
      )}
    </div>
  );
}
