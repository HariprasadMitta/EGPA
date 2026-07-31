"use client";

import { useAuth } from "@/lib/auth";
import { canAccessDeveloperTools } from "@/lib/roles";
import { useStore } from "@/lib/store";
import { useMlOps } from "@/lib/mlops";
import { RiskBadge } from "@/components/RiskBadge";
import { ExecutionRun, PingResult, SubAgentStep } from "@/types";

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
            Runtime Observability Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Real usage and step-level history, measured directly from executions run in this app
            - nothing on this page is simulated.
          </p>
        </div>
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
