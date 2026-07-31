"use client";

import { useState } from "react";
import Link from "next/link";
import { canAccessDeveloperTools, useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { RiskBadge } from "@/components/RiskBadge";
import { PipelineTrain } from "@/components/PipelineTrain";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { ExecutionRun, SubAgentStep, SubAgentStepStatus } from "@/types";

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

function ExecutionCard({ run, isLive }: { run: ExecutionRun; isLive: boolean }) {
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
        {run.steps.map((step) => (
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
            {step.output && (
              <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">{step.output}</p>
            )}
            {step.status === "done" && (
              <p className="mt-2 text-xs text-[var(--muted)]">
                {step.provider} &middot; {step.inputTokens + step.outputTokens} tokens &middot; $
                {step.costUsd.toFixed(4)} &middot; {step.durationMs}ms
              </p>
            )}
          </div>
        ))}
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

export default function ExecutionPage() {
  const { user } = useAuth();
  const { active, startExecution, updateExecutionStep, failExecution } = useStore();
  const [running, setRunning] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);

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
      const planData = await planRes.json();
      setPlanning(false);
      if (!planRes.ok) {
        setPlanError(planData.error || "Master agent planning failed.");
        setRunning(false);
        setCurrentExecutionId(null);
        return;
      }

      const steps: SubAgentStep[] = planData.steps.map(
        (s: { name: string; tool: string; task: string }, i: number) => ({
          id: `step-${i}`,
          name: s.name,
          tool: s.tool,
          task: s.task,
          status: "pending" as SubAgentStepStatus,
          output: null,
          provider: null,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          durationMs: 0,
        })
      );

      await startExecution(useCase.id, executionId, runNumber, planData.masterAgentSummary, steps);

      for (const step of steps) {
        await updateExecutionStep(useCase.id, executionId, step.id, { status: "running" });
        try {
          const stepRes = await fetch("/api/execute-step", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              useCaseTitle: useCase.title,
              useCaseDescription: useCase.description,
              masterAgentSummary: planData.masterAgentSummary,
              step: { name: step.name, tool: step.tool, task: step.task },
            }),
          });
          const stepData = await stepRes.json();
          if (!stepRes.ok) {
            await updateExecutionStep(useCase.id, executionId, step.id, {
              status: "error",
              output: stepData.error || "Sub-agent execution failed.",
            });
            continue;
          }
          await updateExecutionStep(useCase.id, executionId, step.id, {
            status: "done",
            output: stepData.output,
            provider: stepData.provider,
            inputTokens: stepData.inputTokens,
            outputTokens: stepData.outputTokens,
            costUsd: stepData.costUsd,
            durationMs: stepData.durationMs,
          });
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

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <p className="text-sm text-[var(--muted)]">
          Running this makes real LLM calls (one master-agent planning call,
          then one call per sub-agent step) and spends real tokens.
        </p>
        {planError && <p className="mt-3 text-sm text-[var(--tier-critical)]">{planError}</p>}
        <button
          onClick={runExecution}
          disabled={running}
          className="mt-4 rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running
            ? planning
              ? "Planning..."
              : "Running..."
            : `Run execution${executions.length > 0 ? ` (run #${executions.length + 1})` : ""}`}
        </button>
      </div>

      {executions.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Execution history &mdash; full lineage per run
          </h2>
          <div className="space-y-6">
            {[...executions].reverse().map((run) => (
              <ExecutionCard key={run.id} run={run} isLive={run.id === currentExecutionId && running} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
