"use client";

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { UseCaseBundle } from "@/types";

type StageState = "done" | "current" | "pending";

interface Stage {
  key: string;
  label: string;
  href: string;
  state: StageState;
}

function computeStages(bundle: UseCaseBundle): Stage[] {
  const recommendationDone = Boolean(bundle.recommendation);
  const gateDone = Boolean(bundle.gate?.acknowledged);
  const gateStarted = Boolean(bundle.gate);
  const adrDone = Boolean(bundle.adr);
  const latestExecution = bundle.executions[bundle.executions.length - 1];
  const executionDone = latestExecution?.status === "completed";
  const executionRunning =
    latestExecution?.status === "running" || latestExecution?.status === "planning";

  return [
    {
      key: "recommendation",
      label: "Recommendation",
      href: "/recommendation",
      state: recommendationDone ? "done" : "current",
    },
    {
      key: "gate",
      label: "Governance Gate",
      href: "/gate",
      state: gateDone ? "done" : gateStarted ? "current" : "pending",
    },
    {
      key: "adr",
      label: "ADR",
      href: "/adr",
      state: adrDone ? "done" : gateDone ? "current" : "pending",
    },
    {
      key: "execution",
      label: "Execution",
      href: "/execution",
      state: executionDone ? "done" : executionRunning ? "current" : adrDone ? "current" : "pending",
    },
  ];
}

const DOT_STYLES: Record<StageState, string> = {
  done: "bg-[var(--status-done)] border-[var(--status-done)] text-white",
  current: "bg-[var(--status-current)] border-[var(--status-current)] text-white status-blink",
  pending: "bg-[var(--status-pending-bg)] border-[var(--status-pending)] text-[var(--status-pending)]",
};

const LABEL_STYLES: Record<StageState, string> = {
  done: "text-[var(--status-done)]",
  current: "text-[var(--status-current)] font-semibold",
  pending: "text-[var(--status-pending)]",
};

export function PipelineTrain({
  bundle,
  onNavigate,
}: {
  bundle: UseCaseBundle;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { setActiveId } = useStore();
  const stages = computeStages(bundle);

  function goTo(href: string) {
    setActiveId(bundle.useCase.id);
    router.push(href);
    onNavigate?.();
  }

  return (
    <div className="flex items-start" onClick={(e) => e.stopPropagation()}>
      {stages.map((stage, i) => (
        <div key={stage.key} className="flex items-start">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => goTo(stage.href)}
              title={`${stage.label} — ${stage.state}`}
              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-transform hover:scale-110 ${DOT_STYLES[stage.state]}`}
            >
              {stage.state === "done" ? "✓" : i + 1}
            </button>
            <span className={`w-16 text-center text-[10px] leading-tight ${LABEL_STYLES[stage.state]}`}>
              {stage.label}
            </span>
          </div>
          {i < stages.length - 1 && (
            <span
              className={`mt-3.5 h-0.5 w-6 flex-none ${
                stage.state === "done" ? "bg-[var(--status-done)]" : "bg-[var(--border)]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function PipelineTrainLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-[var(--muted)]">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--status-done)]" /> Completed
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--status-current)] status-blink" /> Current
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full border border-[var(--status-pending)] bg-[var(--status-pending-bg)]" /> Upcoming
      </span>
    </div>
  );
}
