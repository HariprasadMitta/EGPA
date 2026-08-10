"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AgentLoopVisualizer, IDLE_AGENT_LOOP_STATE, type AgentLoopState } from "@/components/AgentLoopVisualizer";
import { readSseEvents } from "@/lib/sse";

// Sentinel for a session that exists only in local state, not yet
// persisted - "+ New session" no longer creates a real
// ProblemDiscoverySession row until the first message is actually sent, so
// clicking it a few times and changing your mind doesn't leave empty
// "New discovery session" rows cluttering the sidebar forever.
const DRAFT_SESSION_ID = "";

const DISCOVERY_HANDOFF_KEY = "egpa-discovery-handoff-v1";

interface DiscoveryChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
}

interface SessionSummary {
  id: string;
  title: string | null;
  status: "active" | "completed";
  recommendedPath: string | null;
  handedOffUseCaseId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionDetail extends SessionSummary {
  messages: DiscoveryChatMessage[];
  pathRationale: string | null;
  problemStatement: string | null;
  suggestedTitle: string | null;
}

const PATH_LABELS: Record<string, string> = {
  "process-only": "Process-only fix - no agent warranted",
  "extend-existing": "Extend an existing use case",
  "research-first": "Research first before committing to a build",
  build: "Build - proceed to Intake",
};

export default function DiscoveryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [active, setActive] = useState<SessionDetail | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveActivity, setLiveActivity] = useState<AgentLoopState | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function loadSessions() {
    fetch("/api/discovery-sessions")
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []));
  }

  useEffect(() => {
    if (user) loadSessions();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length]);

  async function selectSession(id: string) {
    setError(null);
    const res = await fetch(`/api/discovery-sessions/${id}`);
    const data = await res.json();
    if (res.ok) setActive(data);
  }

  function newSession() {
    setError(null);
    // Local-only draft - nothing is persisted until send() actually fires
    // the first message.
    setActive({
      id: DRAFT_SESSION_ID,
      title: null,
      status: "active",
      recommendedPath: null,
      handedOffUseCaseId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      pathRationale: null,
      problemStatement: null,
      suggestedTitle: null,
    });
  }

  async function deleteSession(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/discovery-sessions/${id}`, { method: "DELETE" });
      if (active?.id === id) setActive(null);
      loadSessions();
    } finally {
      setDeletingId(null);
    }
  }

  async function send() {
    if (!active || !input.trim()) return;
    const message = input.trim();
    setSending(true);
    setError(null);
    setLiveActivity(IDLE_AGENT_LOOP_STATE);
    try {
      let sessionId = active.id;
      if (!sessionId) {
        const createRes = await fetch("/api/discovery-sessions", { method: "POST" });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || "Failed to create session.");
        sessionId = createData.id as string;
        setActive((prev) => (prev ? { ...prev, id: sessionId } : prev));
      }

      const res = await fetch(`/api/discovery-sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to send message." }));
        throw new Error(data.error);
      }

      for await (const event of readSseEvents(res)) {
        if (event.type === "thinking") {
          setLiveActivity((prev) => ({ ...(prev ?? IDLE_AGENT_LOOP_STATE), node: "agent" }));
        } else if (event.type === "tool_call") {
          setLiveActivity((prev) => ({
            ...(prev ?? IDLE_AGENT_LOOP_STATE),
            node: "tools",
            toolName: event.toolName as string,
            toolStatus: "calling",
          }));
        } else if (event.type === "tool_result") {
          setLiveActivity((prev) => ({
            ...(prev ?? IDLE_AGENT_LOOP_STATE),
            toolStatus: "done",
            toolResultPreview: event.result as string,
          }));
        } else if (event.type === "done") {
          const messages = event.messages as DiscoveryChatMessage[];
          setActive((prev) => (prev ? { ...prev, id: sessionId, messages, title: event.title as string } : prev));
          setInput("");
          loadSessions();
        } else if (event.type === "error") {
          throw new Error(event.error as string);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
      setLiveActivity(null);
    }
  }

  async function wrapUp() {
    if (!active) return;
    setFinalizing(true);
    setError(null);
    try {
      const res = await fetch(`/api/discovery-sessions/${active.id}/finalize`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActive({
        ...active,
        status: data.status,
        recommendedPath: data.recommendedPath,
        pathRationale: data.pathRationale,
        problemStatement: data.problemStatement,
        suggestedTitle: data.suggestedTitle,
        title: data.suggestedTitle ?? active.title,
      });
      loadSessions();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFinalizing(false);
    }
  }

  function startIntake() {
    if (!active) return;
    const firstUserMessage = active.messages.find((m) => m.role === "user")?.content ?? "";
    window.sessionStorage.setItem(
      DISCOVERY_HANDOFF_KEY,
      JSON.stringify({
        sessionId: active.id,
        description: active.problemStatement ?? firstUserMessage,
        title: active.suggestedTitle ?? "",
      })
    );
    router.push("/intake");
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--brand-strong)]">Sign in required</h1>
        <Link href="/login" className="mt-6 inline-block rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-6 py-12 lg:grid-cols-[260px_1fr]">
      <div>
        <h1 className="text-xl font-bold text-[var(--brand-strong)]">Discovery Advisor</h1>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Talk through a business problem before Intake - real chat, real search over this org&apos;s own use
          cases, and a reasoned recommendation before any agent gets built.
        </p>
        <button
          onClick={newSession}
          className="mt-4 w-full rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-strong)]"
        >
          + New session
        </button>
        <div className="mt-4 space-y-1.5">
          {active?.id === DRAFT_SESSION_ID && (
            <div className="rounded-md border border-[var(--brand)] bg-[var(--background)] px-3 py-2 text-left text-xs">
              <p className="truncate font-medium">New discovery session</p>
              <p className="mt-0.5 text-[var(--muted)]">Not saved yet - send a message to start it</p>
            </div>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`group flex items-center gap-1 rounded-md border transition-colors ${
                active?.id === s.id
                  ? "border-[var(--brand)] bg-[var(--background)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--background)]"
              }`}
            >
              <button onClick={() => selectSession(s.id)} className="min-w-0 flex-1 px-3 py-2 text-left text-xs">
                <p className="truncate font-medium">{s.title ?? "New discovery session"}</p>
                <p className="mt-0.5 text-[var(--muted)]">
                  {s.status === "completed" ? PATH_LABELS[s.recommendedPath ?? ""] ?? "Completed" : "In progress"}
                </p>
              </button>
              <button
                onClick={() => deleteSession(s.id)}
                disabled={deletingId === s.id}
                title="Delete session"
                className="flex-none px-2 text-[var(--muted)] opacity-0 transition-opacity hover:text-[var(--tier-critical)] group-hover:opacity-100 disabled:opacity-60"
              >
                &times;
              </button>
            </div>
          ))}
          {sessions.length === 0 && active?.id !== DRAFT_SESSION_ID && (
            <p className="text-xs text-[var(--muted)]">No sessions yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        {!active ? (
          <p className="text-sm text-[var(--muted)]">Start a new session or pick one from the left.</p>
        ) : (
          <>
            <div className="flex max-h-[55vh] min-h-[300px] flex-col gap-3 overflow-y-auto pr-1">
              {active.messages.length === 0 && (
                <p className="text-sm text-[var(--muted)]">
                  Describe the business problem you&apos;re trying to solve - the advisor will ask clarifying
                  questions before suggesting anything.
                </p>
              )}
              {active.messages.map((m, i) =>
                m.role === "tool" ? (
                  <div key={i}>
                    <AgentLoopVisualizer
                      leftLabel="Discovery Advisor"
                      state={{
                        node: null,
                        provider: null,
                        toolName: "search_existing_use_cases",
                        toolStatus: "done",
                        toolResultPreview: m.content,
                        inputTokens: 0,
                        outputTokens: 0,
                      }}
                    />
                    <p className="mt-1 pl-1 text-[11px] text-[var(--muted)]">{m.content}</p>
                  </div>
                ) : (
                  <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                    <span className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {m.role === "user" ? (user?.name ?? "You") : "Discovery Advisor"}
                    </span>
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                        m.role === "user"
                          ? "bg-[var(--brand)] text-white"
                          : "border border-[var(--border)] bg-[var(--background)]"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                )
              )}
              <div ref={bottomRef} />
            </div>

            {sending && liveActivity && (
              <div className="mt-3">
                <AgentLoopVisualizer leftLabel="Discovery Advisor" state={liveActivity} />
                <p className="mt-1 pl-1 text-[11px] text-[var(--muted)]">
                  {liveActivity.toolStatus === "calling"
                    ? "Searching existing use cases..."
                    : liveActivity.toolStatus === "done"
                      ? "Composing a reply..."
                      : "Thinking..."}
                </p>
              </div>
            )}

            {error && <p className="mt-3 text-xs text-[var(--tier-critical)]">{error}</p>}

            {active.status === "active" ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !sending) send();
                  }}
                  placeholder="Describe the problem, or answer the advisor's question..."
                  className="min-w-[220px] flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
                <button
                  onClick={send}
                  disabled={sending || !input.trim()}
                  className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {sending ? "Working..." : "Send"}
                </button>
                <button
                  onClick={wrapUp}
                  disabled={finalizing || active.messages.filter((m) => m.role === "user").length === 0}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {finalizing ? "Wrapping up..." : "Wrap this up"}
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-[var(--tier-low)]/30 bg-[var(--tier-low-bg)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Recommendation: {PATH_LABELS[active.recommendedPath ?? ""] ?? active.recommendedPath}
                </p>
                <p className="mt-2 text-sm">{active.pathRationale}</p>
                {active.problemStatement && (
                  <>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Problem statement (submission-ready)
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">{active.problemStatement}</p>
                  </>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`/api/discovery-sessions/${active.id}/summary`}
                    className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold hover:bg-[var(--background)]"
                  >
                    Download summary
                  </a>
                  {active.recommendedPath === "build" && !active.handedOffUseCaseId && (
                    <button
                      onClick={startIntake}
                      className="rounded-full bg-[var(--brand)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-strong)]"
                    >
                      Start Intake with this problem statement
                    </button>
                  )}
                  {active.handedOffUseCaseId && (
                    <span className="rounded-full border border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">
                      Already handed off to Intake
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
