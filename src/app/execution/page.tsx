"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { canAccessDeveloperTools } from "@/lib/roles";
import { useStore } from "@/lib/store";
import { readSseEvents } from "@/lib/sse";
import { RiskBadge } from "@/components/RiskBadge";
import { PipelineTrain } from "@/components/PipelineTrain";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { AgentLoopVisualizer, AgentLoopState, IDLE_AGENT_LOOP_STATE } from "@/components/AgentLoopVisualizer";
import { ExecutionRun, SubAgentStep, SubAgentStepStatus, WebhookTriggerInfo } from "@/types";

const STATUS_ICON: Record<SubAgentStepStatus, string> = {
  pending: "○",
  running: "◐",
  done: "✓",
  error: "✕",
};

const STATUS_STYLE: Record<SubAgentStepStatus, string> = {
  pending: "text-[var(--status-pending)] border-[var(--status-pending)] bg-[var(--status-pending-bg)]",
  running: "text-white border-[var(--status-current)] bg-[var(--status-current)] status-blink",
  done: "text-white border-[var(--status-done)] bg-[var(--status-done)]",
  error: "text-[var(--tier-critical)] border-[var(--tier-critical)] bg-[var(--tier-critical-bg)]",
};

const RUN_STATUS_LABEL: Record<ExecutionRun["status"], string> = {
  planning: "Planning",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

function makeExecutionId(): string {
  return `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface PlanStepDraft {
  name: string;
  tool: string;
  task: string;
  rationale: string;
}

function ExecutionCard({
  run,
  isLive,
  liveOutput,
  liveActivity,
}: {
  run: ExecutionRun;
  isLive: boolean;
  liveOutput: Record<string, string>;
  liveActivity: Record<string, AgentLoopState>;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--brand-strong)]">
            Execution #{run.runNumber}
            {isLive && (
              <span className="ml-2 rounded-full bg-[var(--status-current-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--status-current)]">
                Live
              </span>
            )}
            {run.dryRun && (
              <span className="ml-2 rounded-full bg-[var(--status-pending-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--status-pending)]">
                Dry run
              </span>
            )}
          </h3>
          <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">{run.id}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            run.status === "completed"
              ? "bg-[var(--status-done-bg)] text-[var(--status-done)]"
              : run.status === "failed"
                ? "bg-[var(--tier-critical-bg)] text-[var(--tier-critical)]"
                : "bg-[var(--status-current-bg)] text-[var(--status-current)]"
          }`}
        >
          {RUN_STATUS_LABEL[run.status]}
        </span>
      </div>

      <p className="mt-3 text-sm">{run.masterAgentSummary}</p>

      <div className="mt-4 space-y-3">
        {run.steps.map((step, i) => {
          const streaming = isLive && step.status === "running" ? liveOutput[step.id] : undefined;
          const displayOutput = step.output ?? streaming;
          const previous = i > 0 ? run.steps[i - 1] : null;
          return (
            <div key={step.id} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border text-xs font-bold ${STATUS_STYLE[step.status]}`}
                >
                  {STATUS_ICON[step.status]}
                </span>
                <div>
                  <p className="text-sm font-semibold">{step.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {step.tool} &middot; {step.task}
                  </p>
                </div>
              </div>
              {step.rationale && (
                <p className="mt-2 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-3 py-1.5 text-xs text-[var(--accent)]">
                  <span className="font-semibold">Why this tool: </span>
                  {step.rationale}
                </p>
              )}
              {isLive && step.status === "running" && (
                <div className="mt-2">
                  <AgentLoopVisualizer leftLabel={step.name} state={liveActivity[step.id] ?? IDLE_AGENT_LOOP_STATE} />
                </div>
              )}
              {previous?.output && (
                <p className="mt-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)]">
                  <span className="font-semibold text-[var(--foreground)]">Received from &quot;{previous.name}&quot;: </span>
                  {previous.output}
                </p>
              )}
              {displayOutput && (
                <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">
                  {displayOutput}
                  {streaming !== undefined && <span className="status-blink">&#9611;</span>}
                </p>
              )}
              {step.status === "done" && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {step.provider} &middot; {step.inputTokens + step.outputTokens} tokens &middot; $
                  {step.costUsd.toFixed(4)} &middot; {step.durationMs}ms
                  {step.confidenceScore !== null && (
                    <>
                      {" "}
                      &middot;{" "}
                      <span
                        className={
                          step.confidenceScore >= 0.7
                            ? "text-[var(--status-done)]"
                            : step.confidenceScore >= 0.4
                              ? "text-[var(--tier-medium)]"
                              : "text-[var(--tier-critical)]"
                        }
                      >
                        confidence {(step.confidenceScore * 100).toFixed(0)}%
                      </span>
                    </>
                  )}
                  {step.piiDetected && (
                    <span className="ml-1 text-[var(--tier-critical)]">
                      &middot; {step.piiMatchCount} real PII match{step.piiMatchCount === 1 ? "" : "es"} redacted
                    </span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {run.status === "completed" && (
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-[var(--muted)]">Total tokens</p>
            <p className="font-bold">
              {(run.totalInputTokens + run.totalOutputTokens).toLocaleString("en-US")}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Estimated cost</p>
            <p className="font-bold">${run.totalCostUsd.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Sub-agents run</p>
            <p className="font-bold">{run.steps.length}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Duration</p>
            <p className="font-bold">
              {run.completedAt
                ? `${Math.round(
                    (new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
                  )}s`
                : "-"}
            </p>
          </div>
        </div>
      )}

      {run.status === "failed" && run.error && (
        <p className="mt-4 rounded-md border border-[var(--tier-critical)]/30 bg-[var(--tier-critical-bg)] px-4 py-3 text-sm text-[var(--tier-critical)]">
          {run.error}
        </p>
      )}
    </div>
  );
}

function WebhookTriggerPanel({
  useCaseId,
  webhookTrigger,
}: {
  useCaseId: string;
  webhookTrigger: WebhookTriggerInfo | null;
}) {
  const { generateWebhookTrigger, toggleWebhookTrigger } = useStore();
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (webhookTrigger && !window.confirm("Regenerating invalidates any previously issued token. Continue?")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await generateWebhookTrigger(useCaseId);
      setNewToken(token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle() {
    if (!webhookTrigger) return;
    setBusy(true);
    setError(null);
    try {
      await toggleWebhookTrigger(useCaseId, !webhookTrigger.enabled);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const curl = `curl -X POST ${origin}/api/webhooks/executions/${useCaseId} \\\n  -H "Authorization: Bearer ${newToken ?? "<token>"}"`;

  return (
    <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Automation trigger &mdash; real webhook, no human click required
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {webhookTrigger
          ? `${webhookTrigger.enabled ? "Enabled" : "Disabled"} · triggered ${webhookTrigger.triggerCount} time${webhookTrigger.triggerCount === 1 ? "" : "s"}${
              webhookTrigger.lastTriggeredAt
                ? ` · last: ${new Date(webhookTrigger.lastTriggeredAt).toLocaleString("en-US")}`
                : ""
            }`
          : "No webhook trigger configured yet for this use case."}
      </p>

      {error && <p className="mt-2 text-sm text-[var(--tier-critical)]">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          onClick={handleGenerate}
          disabled={busy}
          className="rounded-full bg-[var(--brand)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {webhookTrigger ? "Regenerate token" : "Generate token"}
        </button>
        {webhookTrigger && (
          <button
            onClick={handleToggle}
            disabled={busy}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {webhookTrigger.enabled ? "Disable" : "Enable"}
          </button>
        )}
      </div>

      {newToken && (
        <div className="mt-4 rounded-md border border-[var(--status-pending)]/40 bg-[var(--status-pending-bg)] p-4 text-xs">
          <p className="font-semibold text-[var(--tier-critical)]">
            Copy this token now &mdash; it will not be shown again.
          </p>
          <pre className="mt-2 overflow-x-auto rounded bg-[var(--background)] p-3 font-mono">{newToken}</pre>
          <p className="mt-3 text-[var(--muted)]">Trigger a real execution from outside the browser:</p>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-[var(--background)] p-3 font-mono">{curl}</pre>
        </div>
      )}
    </div>
  );
}

export default function ExecutionPage() {
  const { user } = useAuth();
  const { active, startExecution, updateExecutionStep, failExecution } = useStore();
  const [running, setRunning] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const [planningSummary, setPlanningSummary] = useState("");
  const [planningSteps, setPlanningSteps] = useState<PlanStepDraft[]>([]);
  const [liveOutput, setLiveOutput] = useState<Record<string, string>>({});
  const [liveActivity, setLiveActivity] = useState<Record<string, AgentLoopState>>({});
  const [dryRun, setDryRun] = useState(false);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--brand-strong)]">Sign in required</h1>
        <p className="mt-2 text-[var(--muted)]">
          Execution is single-sign-on access for developers. Sign in to continue.
        </p>
        <Link href="/login" className="mt-6 inline-block rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white">
          Sign in
        </Link>
      </div>
    );
  }

  if (!canAccessDeveloperTools(user.role)) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--brand-strong)]">Developer access required</h1>
        <p className="mt-2 text-[var(--muted)]">
          Signed in as {user.name} ({user.role}). Only the Developer or Admin
          role has single-sign-on access to execute use cases from this
          abstraction layer.
        </p>
      </div>
    );
  }

  if (!active || !active.recommendation) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--brand-strong)]">No use case selected</h1>
        <p className="mt-2 text-[var(--muted)]">Open a use case from the Portfolio first.</p>
        <Link href="/portfolio" className="mt-6 inline-block rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white">
          Go to portfolio
        </Link>
      </div>
    );
  }

  if (!active.gate?.acknowledged) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--brand-strong)]">Governance gate not cleared</h1>
        <p className="mt-2 text-[var(--muted)]">
          Execution is enforced, not optional &mdash; this use case must clear
          its governance gate before it can run.
        </p>
        <Link href="/gate" className="mt-6 inline-block rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white">
          Go to governance gate
        </Link>
      </div>
    );
  }

  const { useCase, recommendation, executions } = active;
  const currentRun = executions.find((e) => e.id === currentExecutionId) ?? null;

  async function runExecution() {
    if (!recommendation) return;
    setRunning(true);
    setPlanning(true);
    setPlanError(null);
    setPlanningSummary("");
    setPlanningSteps([]);
    setLiveOutput({});

    const executionId = makeExecutionId();
    const runNumber = executions.length + 1;
    setCurrentExecutionId(executionId);

    try {
      const planRes = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: useCase.title,
          description: useCase.description,
          riskTier: useCase.riskTier,
          framework: recommendation.framework,
          tools: recommendation.tools,
          harnessPattern: recommendation.harnessPattern,
        }),
      });

      if (!planRes.ok) {
        const data = await planRes.json().catch(() => ({}));
        setPlanError(data.error || "Master agent planning failed.");
        setRunning(false);
        setPlanning(false);
        setCurrentExecutionId(null);
        return;
      }

      let masterAgentSummary = "";
      const rawSteps: PlanStepDraft[] = [];
      let planErrorMessage: string | null = null;

      for await (const event of readSseEvents(planRes)) {
        if (event.type === "summary") {
          masterAgentSummary = event.text as string;
          setPlanningSummary(masterAgentSummary);
        } else if (event.type === "step") {
          const step: PlanStepDraft = {
            name: event.name as string,
            tool: event.tool as string,
            task: event.task as string,
            rationale: (event.rationale as string) ?? "",
          };
          rawSteps.push(step);
          setPlanningSteps((prev) => [...prev, step]);
        } else if (event.type === "error") {
          planErrorMessage = event.error as string;
        }
      }

      setPlanning(false);

      if (planErrorMessage || rawSteps.length === 0) {
        setPlanError(planErrorMessage || "Master agent returned no steps.");
        setRunning(false);
        setCurrentExecutionId(null);
        return;
      }

      const steps: SubAgentStep[] = rawSteps.map((s, i) => ({
        id: `step-${i}`,
        name: s.name,
        tool: s.tool,
        task: s.task,
        rationale: s.rationale || null,
        status: "pending" as SubAgentStepStatus,
        output: null,
        provider: null,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        durationMs: 0,
        toolCallCount: 0,
        confidenceScore: null,
        piiDetected: false,
        piiMatchCount: 0,
      }));

      try {
        await startExecution(useCase.id, executionId, runNumber, masterAgentSummary, steps, dryRun);
      } catch (err) {
        // No ExecutionRun row exists yet at this point (rejected before
        // creation - e.g. kill switch engaged, gate not cleared) - show the
        // real error directly rather than falling through to the outer
        // catch's failExecution, which would try to update a row that was
        // never created.
        setPlanError((err as Error).message);
        setRunning(false);
        setCurrentExecutionId(null);
        return;
      }

      const priorSteps: { name: string; output: string }[] = [];

      for (const step of steps) {
        await updateExecutionStep(useCase.id, executionId, step.id, { status: "running" });
        setLiveOutput((prev) => ({ ...prev, [step.id]: "" }));
        setLiveActivity((prev) => ({ ...prev, [step.id]: IDLE_AGENT_LOOP_STATE }));
        try {
          const stepRes = await fetch("/api/execute-step", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              useCaseTitle: useCase.title,
              useCaseDescription: useCase.description,
              masterAgentSummary,
              executionId,
              stepId: step.id,
              step: { name: step.name, tool: step.tool, task: step.task, rationale: step.rationale ?? undefined },
              priorSteps,
            }),
          });

          if (!stepRes.ok) {
            const data = await stepRes.json().catch(() => ({}));
            await updateExecutionStep(useCase.id, executionId, step.id, {
              status: "error",
              output: data.error || "Sub-agent execution failed.",
            });
            continue;
          }

          function patchActivity(patch: Partial<AgentLoopState>) {
            setLiveActivity((prev) => ({
              ...prev,
              [step.id]: { ...(prev[step.id] ?? IDLE_AGENT_LOOP_STATE), ...patch },
            }));
          }

          let finalEvent: Record<string, unknown> | null = null;
          for await (const event of readSseEvents(stepRes)) {
            if (event.type === "token") {
              const text = event.text as string;
              setLiveOutput((prev) => ({ ...prev, [step.id]: (prev[step.id] ?? "") + text }));
            } else if (event.type === "node") {
              patchActivity({ node: event.node as "agent" | "tools" });
            } else if (event.type === "model") {
              patchActivity({ provider: event.provider as string });
            } else if (event.type === "tool_call") {
              patchActivity({ toolName: event.toolName as string, toolStatus: "calling" });
            } else if (event.type === "tool_result") {
              patchActivity({ toolStatus: "done", toolResultPreview: event.result as string });
            } else if (event.type === "usage_delta") {
              patchActivity({ inputTokens: event.inputTokens as number, outputTokens: event.outputTokens as number });
            } else if (event.type === "done" || event.type === "error") {
              finalEvent = event;
            }
          }

          if (!finalEvent || finalEvent.type === "error") {
            await updateExecutionStep(useCase.id, executionId, step.id, {
              status: "error",
              output: (finalEvent?.error as string) || "Sub-agent execution failed.",
            });
            continue;
          }

          await updateExecutionStep(useCase.id, executionId, step.id, {
            status: "done",
            output: finalEvent.output as string,
            provider: finalEvent.provider as string,
            inputTokens: finalEvent.inputTokens as number,
            outputTokens: finalEvent.outputTokens as number,
            costUsd: finalEvent.costUsd as number,
            durationMs: finalEvent.durationMs as number,
          });
          priorSteps.push({ name: step.name, output: finalEvent.output as string });
        } catch (err) {
          await updateExecutionStep(useCase.id, executionId, step.id, {
            status: "error",
            output: (err as Error).message,
          });
        }
      }
    } catch (err) {
      await failExecution(useCase.id, executionId, (err as Error).message);
    } finally {
      setRunning(false);
      setPlanning(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Execution</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{useCase.title}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {executions.length} execution{executions.length === 1 ? "" : "s"} run for this use case
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <RiskBadge tier={useCase.riskTier} />
          <PipelineTrain bundle={active} />
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          {currentRun ? "Live architecture" : "Planned architecture"}
        </h2>
        <p className="mt-1 mb-6 text-xs text-[var(--muted)]">
          {currentRun
            ? "Nodes light up blue while running and turn green as each sub-agent finishes."
            : "This is what will run: a master agent dispatching real LLM-backed sub-agent calls."}
        </p>
        <ArchitectureDiagram recommendation={recommendation} steps={currentRun?.steps} masterActive={planning} />
      </div>

      <WebhookTriggerPanel useCaseId={useCase.id} webhookTrigger={active.webhookTrigger} />

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <p className="text-sm text-[var(--muted)]">
          Running this makes real LLM calls (one master-agent planning call,
          then one call per sub-agent step), streamed live as they&apos;re
          generated, and spends real tokens.
        </p>
        <label className="mt-3 flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} disabled={running} />
          Dry run &mdash; real LLM calls, real cost, but excluded from the audit trail and anomaly baselines (for iterating on a use case without it counting as a governed execution)
        </label>
        {planError && <p className="mt-3 text-sm text-[var(--tier-critical)]">{planError}</p>}
        <button
          onClick={runExecution}
          disabled={running}
          className={`mt-4 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            dryRun ? "bg-[var(--status-pending)] hover:opacity-90" : "bg-[var(--brand)] hover:bg-[var(--brand-strong)]"
          }`}
        >
          {running
            ? planning
              ? "Planning..."
              : "Running..."
            : `${dryRun ? "Run dry-run" : "Run execution"}${executions.length > 0 ? ` (run #${executions.length + 1})` : ""}`}
        </button>

        {planning && (planningSummary || planningSteps.length > 0) && (
          <div className="mt-6 space-y-2 text-left">
            {planningSummary && (
              <p className="text-sm text-[var(--foreground)]">{planningSummary}</p>
            )}
            {planningSteps.map((step, i) => (
              <div
                key={`${step.name}-${i}`}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
              >
                <span className="font-semibold">{step.name}</span>
                <span className="text-[var(--muted)]"> &middot; {step.tool} &middot; {step.task}</span>
                {step.rationale && (
                  <p className="mt-1 text-xs text-[var(--accent)]">Why: {step.rationale}</p>
                )}
              </div>
            ))}
            <span className="status-blink inline-block text-xs text-[var(--muted)]">deciding next step&hellip;</span>
          </div>
        )}
      </div>

      {executions.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Execution history &mdash; full lineage per run
          </h2>
          <div className="space-y-6">
            {[...executions].reverse().map((run) => (
              <ExecutionCard
                key={run.id}
                run={run}
                isLive={run.id === currentExecutionId && running}
                liveOutput={liveOutput}
                liveActivity={liveActivity}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
