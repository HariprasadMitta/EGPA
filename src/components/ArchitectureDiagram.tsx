"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Recommendation, SubAgentStep, SubAgentStepStatus } from "@/types";

type SelectedNode = { type: "master" } | { type: "tool"; tool: string } | null;

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function toolRole(tool: string): string {
  const lower = tool.toLowerCase();
  if (lower.includes("mcp")) {
    return "MCP-based sub-agent: exposes this capability through a standardized Model Context Protocol server, decoupling the tool's implementation from the harness.";
  }
  if (lower.includes("read") || lower.includes("lookup") || lower.includes("registry")) {
    return "Read-access sub-agent: fetches and normalizes data from this system for the master agent to reason over.";
  }
  if (lower.includes("write") || lower.includes("change") || lower.includes("routing")) {
    return "Write-access sub-agent: performs the actual state-changing action, gated by the harness's approval requirements.";
  }
  if (lower.includes("classif") || lower.includes("scor") || lower.includes("detect") || lower.includes("correlation")) {
    return "Analysis sub-agent: scores or classifies input against a model, feeding a structured verdict back to the master agent.";
  }
  if (lower.includes("mask") || lower.includes("redact")) {
    return "Compliance sub-agent: sanitizes sensitive fields before any other sub-agent or log sees them.";
  }
  return "Tool-calling sub-agent: invoked by the master agent for this specific capability as one step in the plan.";
}

// Glow colors keyed to the app's unified status language (done=green,
// current=blinking blue, pending=amber, error=red), but rendered as neon
// outlines on a dark canvas rather than the light pastel cards used
// elsewhere in the app.
const GLOW = {
  neutral: "#2dd4c4",
  selected: "#5eead4",
  pending: "#f59e0b",
  running: "#3b82f6",
  done: "#22c55e",
  error: "#ef4444",
};

function nodeGlowColor(status: SubAgentStepStatus | undefined, isSelected: boolean): string {
  if (status === "pending") return GLOW.pending;
  if (status === "running") return GLOW.running;
  if (status === "done") return GLOW.done;
  if (status === "error") return GLOW.error;
  return isSelected ? GLOW.selected : GLOW.neutral;
}

function nodeClasses(blink: boolean) {
  return `rounded-lg border-2 px-3 py-2.5 text-center text-xs font-medium transition-all ${blink ? "status-blink" : ""}`;
}

export function ArchitectureDiagram({
  recommendation,
  steps,
  masterActive,
}: {
  recommendation: Recommendation;
  steps?: SubAgentStep[];
  masterActive?: boolean;
}) {
  const [selected, setSelected] = useState<SelectedNode>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const masterRef = useRef<HTMLButtonElement>(null);
  const toolRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [loopPath, setLoopPath] = useState<string>("");
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    function recompute() {
      const container = containerRef.current;
      const master = masterRef.current;
      if (!container || !master) return;
      const containerRect = container.getBoundingClientRect();
      const masterRect = master.getBoundingClientRect();
      const masterBottom = {
        x: masterRect.left + masterRect.width / 2 - containerRect.left,
        y: masterRect.bottom - containerRect.top,
      };

      const newLines: Line[] = [];
      let rightmost = { x: masterBottom.x, y: masterBottom.y };
      for (const tool of recommendation.tools) {
        const el = toolRefs.current[tool];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const top = { x: r.left + r.width / 2 - containerRect.left, y: r.top - containerRect.top };
        newLines.push({ x1: masterBottom.x, y1: masterBottom.y, x2: top.x, y2: r.bottom - containerRect.top });
        if (top.x >= rightmost.x) rightmost = { x: r.right - containerRect.left, y: r.top + r.height / 2 - containerRect.top };
      }
      setLines(newLines);
      setContainerSize({ width: containerRect.width, height: containerRect.height });

      const masterRight = { x: masterRect.right - containerRect.left, y: masterRect.top + masterRect.height / 2 - containerRect.top };
      const midX = Math.max(masterRight.x, rightmost.x) + 36;
      setLoopPath(
        `M ${rightmost.x} ${rightmost.y} C ${midX} ${rightmost.y}, ${midX} ${masterRight.y}, ${masterRight.x} ${masterRight.y}`
      );
    }
    recompute();
    const ro = new ResizeObserver(recompute);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [recommendation.tools, steps, masterActive]);

  const masterGlow = masterActive
    ? GLOW.running
    : steps && steps.length > 0 && steps.every((s) => s.status === "done")
      ? GLOW.done
      : steps?.some((s) => s.status === "error")
        ? GLOW.error
        : selected?.type === "master"
          ? GLOW.selected
          : GLOW.neutral;
  const masterBlink = Boolean(masterActive);

  return (
    <div>
      <div
        ref={containerRef}
        className="relative overflow-visible rounded-xl bg-gradient-to-br from-[#0a0f2a] to-[#1a0f3d] p-6 pb-10 pr-16 sm:pr-24"
      >
        <svg
          className="pointer-events-none absolute left-0 top-0"
          width={containerSize.width}
          height={containerSize.height}
          style={{ filter: "drop-shadow(0 0 3px rgba(45,212,196,0.6))" }}
        >
          {lines.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#2dd4c4" strokeWidth={1.5} strokeOpacity={0.7} />
          ))}
          {loopPath && (
            <path
              d={loopPath}
              fill="none"
              stroke="#5eead4"
              strokeWidth={2}
              markerEnd="url(#loop-head)"
            />
          )}
          <defs>
            <marker id="loop-head" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#5eead4" />
            </marker>
          </defs>
        </svg>

        <div className="relative flex flex-col items-center">
          <button
            ref={masterRef}
            onClick={() => setSelected({ type: "master" })}
            className={nodeClasses(masterBlink)}
            style={{
              borderColor: masterGlow,
              boxShadow: `0 0 12px 1px ${masterGlow}80`,
              background: "rgba(255,255,255,0.06)",
              color: "#f8fafc",
            }}
          >
            <span className="text-sm font-semibold">Master Agent</span>
            <span className="block text-xs font-normal text-white/70">{recommendation.framework}</span>
          </button>

          <div className="mt-10 flex w-full max-w-3xl flex-wrap justify-center gap-x-8 gap-y-8">
            {recommendation.tools.map((tool) => {
              const isSelected = selected?.type === "tool" && selected.tool === tool;
              const step = steps?.find((s) => s.tool === tool);
              const glow = nodeGlowColor(step?.status, isSelected);
              return (
                <button
                  key={tool}
                  ref={(el) => {
                    toolRefs.current[tool] = el;
                  }}
                  onClick={() => setSelected({ type: "tool", tool })}
                  className={`w-40 ${nodeClasses(step?.status === "running")}`}
                  style={{
                    borderColor: glow,
                    boxShadow: `0 0 10px 1px ${glow}70`,
                    background: "rgba(255,255,255,0.05)",
                    color: "#f1f5f9",
                  }}
                >
                  {tool}
                </button>
              );
            })}
          </div>
        </div>

        <div className="absolute right-2 top-6 hidden w-16 text-center text-[10px] font-semibold leading-tight text-[#5eead4] sm:block">
          &#8635; {recommendation.loopPattern}
        </div>
        <div className="absolute bottom-3 right-2 hidden w-16 text-center text-[10px] leading-tight text-white/60 sm:block">
          &le;{recommendation.iterationCeiling} iteration{recommendation.iterationCeiling === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-6 rounded-md border border-[var(--border)] bg-[var(--background)] p-4 text-sm">
        {selected === null && (
          <p className="text-[var(--muted)]">
            Click the Master Agent or any sub-agent above to see its role in this architecture.
          </p>
        )}
        {selected?.type === "master" && (
          <>
            <p className="font-semibold text-[var(--brand-strong)]">Master Agent</p>
            <p className="mt-1 text-[var(--muted)]">
              Runs the <strong>{recommendation.harnessPattern}</strong> harness on{" "}
              <strong>{recommendation.framework}</strong>, using a{" "}
              <strong>{recommendation.loopPattern}</strong> control loop (ceiling:{" "}
              {recommendation.iterationCeiling} iterations). It decomposes the use case into
              sub-agent tasks below, dispatches each one, and assembles their results.
            </p>
          </>
        )}
        {selected?.type === "tool" && (
          <>
            <p className="font-semibold text-[var(--brand-strong)]">{selected.tool}</p>
            <p className="mt-1 text-[var(--muted)]">{toolRole(selected.tool)}</p>
          </>
        )}
      </div>
    </div>
  );
}
