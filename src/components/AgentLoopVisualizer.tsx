// Real, reusable two-node agent-loop visual - shows the actual node the
// LangGraph agent is in (agent vs. tools) and, when the one real tool this
// platform's agents can call is actually invoked, the live call/result
// instead of just a token stream. Deliberately dumb/presentational: every
// prop here is a real fact the caller already has from its own SSE stream
// or persisted transcript, nothing computed or guessed inside.
"use client";

export type AgentLoopNode = "agent" | "tools" | null;
export type ToolStatus = "idle" | "calling" | "done";

export interface AgentLoopState {
  node: AgentLoopNode;
  provider: string | null;
  toolName: string | null;
  toolStatus: ToolStatus;
  toolResultPreview: string | null;
  inputTokens: number;
  outputTokens: number;
}

export const IDLE_AGENT_LOOP_STATE: AgentLoopState = {
  node: null,
  provider: null,
  toolName: null,
  toolStatus: "idle",
  toolResultPreview: null,
  inputTokens: 0,
  outputTokens: 0,
};

// RAG-specific labeling: knowledge_base_search and search_existing_use_cases
// are both real retrieval-over-real-data tools, called out as such rather
// than a generic "tool call" - the whole reason this platform's Guide talks
// about the AI Gateway/RAG distinction at all.
const TOOL_LABELS: Record<string, string> = {
  knowledge_base_search: "Knowledge base search (RAG)",
  search_existing_use_cases: "Existing use case search (RAG)",
};

export function toolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

export function AgentLoopVisualizer({
  leftLabel,
  state,
}: {
  leftLabel: string;
  state: AgentLoopState;
}) {
  const active = state.toolStatus === "calling";
  const hasTool = state.toolName !== null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs">
      <div
        className={`flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${
          state.node === "agent"
            ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
            : "border-[var(--border)] text-[var(--muted)]"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${state.node === "agent" ? "bg-[var(--brand)] status-blink" : "bg-[var(--border)]"}`} />
        {leftLabel}
      </div>

      <div className="flex min-w-[120px] flex-1 items-center gap-1.5">
        <div className={`h-px flex-1 ${active ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
        {hasTool && (
          <span
            className={`whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${
              active ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "bg-[var(--status-done-bg)] text-[var(--status-done)]"
            }`}
            title={state.toolResultPreview ?? undefined}
          >
            {toolLabel(state.toolName!)}
            {active ? "..." : " - done"}
          </span>
        )}
        <div className={`h-px flex-1 ${active ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
      </div>

      <div
        className={`flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${
          state.node === "tools"
            ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
            : "border-[var(--border)] text-[var(--muted)]"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${state.node === "tools" ? "bg-[var(--accent)] status-blink" : "bg-[var(--border)]"}`} />
        Tool
      </div>

      {state.provider && <span className="flex-none text-[var(--muted)]">{state.provider}</span>}
      {(state.inputTokens > 0 || state.outputTokens > 0) && (
        <span className="flex-none text-[var(--muted)]">{(state.inputTokens + state.outputTokens).toLocaleString("en-US")} tok</span>
      )}
    </div>
  );
}
