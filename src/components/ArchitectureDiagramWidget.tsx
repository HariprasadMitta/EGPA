"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { canAccessDeveloperTools } from "@/lib/roles";
import type { ArchitectureFlow } from "@/lib/eventBus";

type FlowId = "all" | ArchitectureFlow;

const FLOW_LABELS: Record<ArchitectureFlow, string> = {
  discovery: "Discovery chat turn",
  recommendation: "Recommendation",
  gate: "Gate action",
  execute: "Agentic System run",
  governance: "Governance fetch",
  admin: "Admin config",
  help: "Help chat ask",
  evidence: "Evidence export",
};
const ALL_FLOWS = Object.keys(FLOW_LABELS) as ArchitectureFlow[];

// Human labels for the real sub-phases Discovery and Agentic System publish
// (see the phase argument at their publishFlowActivity call sites) - same
// vocabulary those pages' own SSE streams use, just described in plain
// English here instead of a raw event-type string.
const PHASE_LABELS: Record<string, string> = {
  thinking: "thinking",
  tool_call: "calling a real tool",
  tool_result: "got a real result back",
  done: "done",
  error: "hit a real error",
  "node:agent": "planning the next step",
  "node:tools": "calling a tool",
  model: "model attributed",
  usage_delta: "token usage updated",
};

// Which real flow a given URL path belongs to, so the widget can default to
// "this page's own architecture" the moment it opens - no click required.
// Unmapped pages (portfolio, dashboard, inbox, adr, ...) fall back to "all"
// since they don't correspond to one single flow.
function pathToFlow(pathname: string): FlowId {
  if (pathname.startsWith("/discovery")) return "discovery";
  if (pathname.startsWith("/recommendation")) return "recommendation";
  if (pathname.startsWith("/gate")) return "gate";
  if (pathname.startsWith("/execution")) return "execute";
  if (pathname.startsWith("/governance")) return "governance";
  if (pathname.startsWith("/admin")) return "admin";
  return "all";
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
      <path d="M9 4 3 6.5v14L9 18l6 2.5L21 18V4l-6 2.5L9 4Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 4v14M15 6.5v14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CLIENT = "var(--series-1)";
const SERVER = "var(--series-3)";
const DATA = "var(--series-7)";
const ACCENT = "var(--tier-medium)";

// Row-by-row Client -> Server boxes, each tagged with the real flow it
// belongs to.
const ROWS: {
  flow: Exclude<FlowId, "all">;
  y: number;
  clientLabel: string;
  clientSub?: string;
  clientDashed?: boolean;
  serverLabel: string;
  serverSub: string;
  serverLines?: string[];
  arrowLabel: string;
}[] = [
  { flow: "discovery", y: 50, clientLabel: "Discovery page", serverLabel: "/discovery-sessions", serverSub: "discoveryAgent.ts", arrowLabel: "chat turn (SSE)" },
  { flow: "recommendation", y: 134, clientLabel: "Recommendation page", serverLabel: ".../recommendation", serverSub: "recommend/route.ts", arrowLabel: "get recommendation" },
  { flow: "gate", y: 218, clientLabel: "Gate page", serverLabel: ".../gate", serverSub: "gate/route.ts", arrowLabel: "acknowledge / approve / reject" },
  { flow: "execute", y: 302, clientLabel: "Agentic System page", clientSub: "AgentLoopVisualizer", serverLabel: "/execute-step", serverSub: "agentStep.ts", arrowLabel: "run step (SSE)" },
  { flow: "governance", y: 386, clientLabel: "Governance page", serverLabel: "governance-posture", serverSub: "business-value/route.ts", serverLines: ["governance-posture", "business-value"], arrowLabel: "fetch posture" },
  { flow: "admin", y: 470, clientLabel: "Admin page", serverLabel: "/admin/*", serverSub: "config, baselines", arrowLabel: "configure" },
  { flow: "help", y: 600, clientLabel: "Help Chat widget", clientSub: "overlay, every page", clientDashed: true, serverLabel: "/help-chat", serverSub: "guideContent.ts (static)", arrowLabel: "ask" },
];

// Real, signed-in Developer/Admin-only floating widget - defaults to
// showing only the current page's own real architecture (see pathToFlow),
// and lights up (with real motion and the real tool/model/error behind it)
// whichever flow just had a genuine request - anyone's, anywhere in the
// org, via the real SSE feed at /api/architecture-activity/events (see
// publishFlowActivity call sites). Not a scripted demo loop. Internal/
// dev-facing (file paths, route names, unbuilt features named outright),
// so gated the same as
// Agentic System / Model Builder rather than shown to every signed-in role.
export function ArchitectureDiagramWidget() {
  const { user } = useAuth();
  const pathname = usePathname();
  const routeFlow = useMemo(() => pathToFlow(pathname ?? "/"), [pathname]);
  const [open, setOpen] = useState(false);
  // A manual click pins a flow (or "all") until you navigate away; null
  // means "no manual pin, follow the current page." Kept separate from the
  // live SSE flow so "Resume live" and route changes both behave sanely.
  const [pinnedFlow, setPinnedFlow] = useState<FlowId | null>(null);
  const [liveFlow, setLiveFlow] = useState<FlowId | null>(null);
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [connected, setConnected] = useState(false);
  const fadeTimer = useRef<number | null>(null);

  // Every page has its own real flow (Discovery page -> the discovery flow,
  // Gate page -> the gate flow, ...) so the widget defaults to showing THAT
  // page's architecture the moment it opens, instead of "All" everywhere.
  // Navigating clears any manual pin so the new page's own flow takes over.
  // Adjusting state during render (comparing against the last seen
  // pathname) rather than in an effect, per React's documented pattern for
  // resetting state in response to a changing value - avoids an extra
  // render pass and the "setState in an effect" lint warning.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (pinnedFlow !== null) setPinnedFlow(null);
  }

  const activeFlow: FlowId = live ? (liveFlow ?? routeFlow) : (pinnedFlow ?? routeFlow);

  // Real, org-wide traffic - every genuine request any signed-in user makes
  // (anywhere, not just this tab) publishes a pulse via publishFlowActivity
  // at the real point in each route where that work happens (see the call
  // sites: discovery-sessions/messages, recommend, gate, execute-step,
  // business-value, help-chat, evidence-export, a handful of /admin/*
  // routes). Discovery and Agentic System publish once per real sub-phase
  // (thinking / calling a tool / got a result / done), not once per request,
  // so this is a live traffic view of real actions, not a scripted demo.
  // When a pulse fades (4s), it falls back to the current page's own flow
  // rather than always resetting to "All".
  useEffect(() => {
    if (!open || !live) return;
    const source = new EventSource("/api/architecture-activity/events");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      try {
        const { flow, phase, detail } = JSON.parse(event.data) as { flow: ArchitectureFlow; phase?: string; detail?: string };
        setLiveFlow(flow);
        setActivePhase(phase ?? null);
        setActiveDetail(detail ?? null);
        if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
        fadeTimer.current = window.setTimeout(() => {
          setLiveFlow(null);
          setActivePhase(null);
          setActiveDetail(null);
        }, 4000);
      } catch {
        // Skip a malformed event rather than crash the subscription.
      }
    };
    return () => {
      source.close();
      setConnected(false);
      if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
    };
  }, [open, live]);

  if (!user || !canAccessDeveloperTools(user.role)) return null;

  function pick(flow: FlowId) {
    setLive(false);
    setPinnedFlow(flow);
    setActivePhase(null);
    setActiveDetail(null);
  }

  // Filtering now HIDES non-matching elements outright (not just dims) once
  // a flow is pinned, live, or auto-detected from the current page - opening
  // the widget on the Discovery page shows only Discovery's real
  // architecture, with no click required.
  function visible(flows: string): boolean {
    if (activeFlow === "all") return true;
    return flows.split(/\s+/).includes(activeFlow);
  }

  // Every element still rendered when a flow is active IS that flow, so it
  // all gets the flow-move/pulse-glow treatment together - no per-element
  // "is this the hit one" check needed anymore now that filtering hides
  // rather than dims.
  const activeClass = activeFlow === "all" ? "" : "arch-hit";

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-24 left-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-lg transition-transform hover:scale-105"
        aria-label={open ? "Close architecture diagram" : "Open architecture diagram"}
      >
        {open ? <CloseIcon /> : <MapIcon />}
      </button>

      {/* Docked panel, not a full-screen modal - no backdrop capturing
          clicks, so the running page underneath stays visible and fully
          interactive while this is open. Translucent + capped footprint so
          the page behind it stays visible through and around the panel. */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 flex max-h-[min(80vh,680px)] w-[min(92vw,760px)] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]/90 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--brand)]/90 px-5 py-3.5 text-white backdrop-blur-md">
              <div>
                <span className="text-sm font-semibold">EGPA Architecture &mdash; This Page, Live</span>
                <p className="text-xs text-white/70">Developer/Admin only &mdash; internal, not for end users</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white" aria-label="Close architecture diagram">
                <CloseIcon />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Highlight a request type">
                <button
                  type="button"
                  onClick={() => pick("all")}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    activeFlow === "all" ? "border-transparent bg-[var(--tier-medium)] text-white" : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--series-1)]"
                  }`}
                >
                  All
                </button>
                {ALL_FLOWS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => pick(f)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      activeFlow === f ? "border-transparent bg-[var(--tier-medium)] text-white" : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--series-1)]"
                    }`}
                  >
                    {FLOW_LABELS[f]}
                  </button>
                ))}
              </div>

              <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                <span className="arch-dotpulse h-1.5 w-1.5 flex-none rounded-full bg-[var(--tier-medium)]" data-live={live ? "1" : "0"} />
                {live
                  ? liveFlow
                    ? `Live: ${FLOW_LABELS[liveFlow as ArchitectureFlow]}${activePhase && PHASE_LABELS[activePhase] ? ` — ${PHASE_LABELS[activePhase]}` : " just happened"}${activeDetail ? ` (${activeDetail})` : ""}`
                    : connected
                      ? routeFlow === "all"
                        ? "Watching real org-wide traffic…"
                        : `This page: ${FLOW_LABELS[routeFlow as ArchitectureFlow]} — watching for real activity`
                      : "Connecting to live traffic…"
                  : activeFlow === "all"
                    ? "Paused — showing everything, unfiltered."
                    : pinnedFlow
                      ? `Pinned: ${FLOW_LABELS[activeFlow as ArchitectureFlow]} — showing only this flow`
                      : `This page (paused): ${FLOW_LABELS[activeFlow as ArchitectureFlow]}`}
                <button type="button" onClick={() => setLive((l) => !l)} className="font-semibold text-[var(--series-1)] underline underline-offset-2">
                  {live ? "Pause" : "Resume live"}
                </button>
              </p>

              <div className={`arch-diagram mt-4 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 ${activeFlow !== "all" ? "filtered" : ""}`}>
                <svg viewBox="0 0 1560 830" className="block min-w-[1240px]" role="img" aria-label="EGPA architecture diagram of the real client, server, and data-layer components involved in the current flow.">
                  <defs>
                    <marker id="wa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
                    </marker>
                    <marker id="waAccent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M0,0 L10,5 L0,10 z" fill={ACCENT} />
                    </marker>
                  </defs>

                  <text x="40" y="26" fontFamily="ui-monospace, monospace" fontSize="11" fontWeight="700" letterSpacing="1.5" fill={CLIENT}>CLIENT — NEXT.JS PAGES</text>
                  <text x="330" y="26" fontFamily="ui-monospace, monospace" fontSize="11" fontWeight="700" letterSpacing="1.5" fill={SERVER}>SERVER — API ROUTES</text>
                  <text x="650" y="26" fontFamily="ui-monospace, monospace" fontSize="11" fontWeight="700" letterSpacing="1.5" fill={DATA}>DATA STORES</text>
                  <text x="960" y="26" fontFamily="ui-monospace, monospace" fontSize="11" fontWeight="700" letterSpacing="1.5" fill={DATA}>AI GATEWAY</text>
                  <text x="1240" y="26" fontFamily="ui-monospace, monospace" fontSize="11" fontWeight="700" letterSpacing="1.5" fill={DATA}>PROVIDERS</text>

                  {/* Postgres */}
                  {visible("discovery recommendation gate execute governance admin evidence") && (
                    <g data-flow="discovery recommendation gate execute governance admin evidence" className={activeClass}>
                      <rect x="650" y="50" width="200" height="476" rx="8" fill={DATA} fillOpacity={0.08} stroke={DATA} strokeWidth={1.4} />
                      <text x="750" y="76" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="12.5" fontWeight="700" fill={DATA}>Postgres (Prisma)</text>
                      <text x="750" y="96" textAnchor="middle" fontSize="10.5" fill="var(--muted)">UseCase · Recommendation</text>
                      <text x="750" y="111" textAnchor="middle" fontSize="10.5" fill="var(--muted)">GovernanceGate · ExecutionRun</text>
                      <text x="750" y="126" textAnchor="middle" fontSize="10.5" fill="var(--muted)">DiscoverySession · Baseline</text>
                      <text x="750" y="141" textAnchor="middle" fontSize="10.5" fill="var(--muted)">ModelRegistryEntry</text>
                    </g>
                  )}
                  {visible("admin") && (
                    <g data-flow="admin" className={activeClass}>
                      <text x="750" y="176" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="10" fontWeight="700" fill={ACCENT}>+ KnowledgeBaseDocument</text>
                      <text x="750" y="190" textAnchor="middle" fontSize="9" fill={ACCENT}>(proposed)</text>
                    </g>
                  )}
                  {visible("discovery") && (
                    <text x="750" y="503" textAnchor="middle" fontSize="9" fill="var(--muted)" data-flow="discovery" className={activeClass}>SQL, not vector — search_existing_use_cases</text>
                  )}

                  {/* Pinecone + Cohere */}
                  {visible("execute admin") && (
                    <g data-flow="execute admin" className={activeClass}>
                      <rect x="650" y="554" width="200" height="56" rx="8" fill={DATA} fillOpacity={0.08} stroke={DATA} strokeWidth={1.4} />
                      <text x="750" y="578" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="12" fontWeight="700" fill={DATA}>Pinecone</text>
                      <text x="750" y="594" textAnchor="middle" fontSize="10" fill="var(--muted)">egpa-knowledge-base index</text>
                    </g>
                  )}
                  {visible("execute admin") && (
                    <g data-flow="execute admin" className={activeClass}>
                      <rect x="650" y="638" width="200" height="48" rx="8" fill={DATA} fillOpacity={0.08} stroke={DATA} strokeWidth={1.4} />
                      <text x="750" y="660" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="12" fontWeight="700" fill={DATA}>Cohere</text>
                      <text x="750" y="675" textAnchor="middle" fontSize="10" fill="var(--muted)">embed-english-v3.0</text>
                    </g>
                  )}

                  {/* Proposed docs index (item 8) */}
                  {visible("help") && (
                    <g data-flow="help" className={activeClass}>
                      <rect x="650" y="722" width="200" height="52" rx="8" fill="none" stroke={ACCENT} strokeWidth={1.6} strokeDasharray="5 4" />
                      <text x="750" y="744" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="11.5" fontWeight="700" fill={ACCENT}>Docs index (proposed)</text>
                      <text x="750" y="760" textAnchor="middle" fontSize="9.5" fill={ACCENT}>separate namespace</text>
                    </g>
                  )}

                  {/* Gateway */}
                  {visible("discovery recommendation execute help") && (
                    <g data-flow="discovery recommendation execute help" className={activeClass}>
                      <rect x="960" y="260" width="190" height="130" rx="8" fill={DATA} fillOpacity={0.08} stroke={DATA} strokeWidth={1.4} />
                      <text x="1055" y="292" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="12.5" fontWeight="700" fill={DATA}>LiteLLM Gateway</text>
                      <text x="1055" y="310" textAnchor="middle" fontSize="10" fill="var(--muted)">Cloud Run</text>
                      <text x="1055" y="330" textAnchor="middle" fontSize="10.5" fill="var(--muted)">egpa-primary</text>
                      <text x="1055" y="346" textAnchor="middle" fontSize="9.5" fill="var(--muted)">+ 3 fallback aliases</text>
                    </g>
                  )}

                  {/* Providers */}
                  {visible("discovery recommendation execute help") && (
                    <g data-flow="discovery recommendation execute help" className={activeClass}>
                      <rect x="1240" y="200" width="160" height="46" rx="7" fill={DATA} fillOpacity={0.08} stroke={DATA} strokeWidth={1.2} />
                      <text x="1320" y="228" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="11" fill={DATA}>OpenRouter</text>
                      <rect x="1240" y="284" width="160" height="46" rx="7" fill={DATA} fillOpacity={0.08} stroke={DATA} strokeWidth={1.2} strokeDasharray="4 3" />
                      <text x="1320" y="312" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="11" fill={DATA}>Anthropic</text>
                      <rect x="1240" y="368" width="160" height="46" rx="7" fill={DATA} fillOpacity={0.08} stroke={DATA} strokeWidth={1.2} strokeDasharray="4 3" />
                      <text x="1320" y="396" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="11" fill={DATA}>Groq</text>
                      <rect x="1240" y="452" width="160" height="46" rx="7" fill={DATA} fillOpacity={0.08} stroke={DATA} strokeWidth={1.2} strokeDasharray="4 3" />
                      <text x="1320" y="480" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="11" fill={DATA}>Gemini</text>
                      <g stroke={DATA} fill="none">
                        <path d="M1150,300 L1240,223" strokeWidth={1.6} markerEnd="url(#wa)" />
                        <path d="M1150,320 L1240,307" strokeWidth={1.2} strokeDasharray="4 3" markerEnd="url(#wa)" />
                        <path d="M1150,340 L1240,391" strokeWidth={1.2} strokeDasharray="4 3" markerEnd="url(#wa)" />
                        <path d="M1150,355 L1240,475" strokeWidth={1.2} strokeDasharray="4 3" markerEnd="url(#wa)" />
                      </g>
                      <text x="1160" y="270" fontSize="9.5" fill="var(--muted)">primary</text>
                      <text x="1160" y="382" fontSize="9.5" fill="var(--muted)">fallback chain</text>
                    </g>
                  )}

                  {/* Rows */}
                  {ROWS.filter((row) => visible(row.flow)).map((row) => (
                    <g key={row.flow} data-flow={row.flow} className={activeClass}>
                      <rect x="40" y={row.y} width="190" height={56} rx="8" fill={CLIENT} fillOpacity={0.08} stroke={CLIENT} strokeWidth={1.4} strokeDasharray={row.clientDashed ? "4 3" : undefined} />
                      <text x="135" y={row.y + (row.clientSub ? 27 : 33)} textAnchor="middle" fontSize="12.5" fontWeight="600" fill={CLIENT}>{row.clientLabel}</text>
                      {row.clientSub && <text x="135" y={row.y + 43} textAnchor="middle" fontSize="9.5" fill="var(--muted)">{row.clientSub}</text>}

                      <rect x="330" y={row.y} width="210" height="56" rx="8" fill={SERVER} fillOpacity={0.08} stroke={SERVER} strokeWidth={1.4} />
                      {row.serverLines ? (
                        <>
                          <text x="435" y={row.y + 22} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="10" fontWeight="700" fill={SERVER}>{row.serverLines[0]}</text>
                          <text x="435" y={row.y + 36} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="10" fontWeight="700" fill={SERVER}>{row.serverLines[1]}</text>
                          <text x="435" y={row.y + 51} textAnchor="middle" fontSize="9.5" fill="var(--muted)">{row.serverSub}</text>
                        </>
                      ) : (
                        <>
                          <text x="435" y={row.y + 25} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="11" fontWeight="700" fill={SERVER}>{row.serverLabel}</text>
                          <text x="435" y={row.y + 40} textAnchor="middle" fontSize="9.5" fill="var(--muted)">{row.serverSub}</text>
                        </>
                      )}
                      <path d={`M230,${row.y + 28} L330,${row.y + 28}`} stroke="var(--foreground)" strokeWidth={1.3} fill="none" markerEnd="url(#wa)" />
                      <text x={row.flow === "execute" ? 245 : 240} y={row.y + 20} fontSize="9.5" fill="var(--muted)">{row.arrowLabel}</text>

                      {row.flow === "execute" && (
                        <>
                          <path d="M540,346 C 600,420 610,600 650,656" stroke={DATA} strokeWidth={1.3} fill="none" markerEnd="url(#wa)" />
                          <text x="562" y="470" fontSize="9.5" fill="var(--muted)">embed query (Cohere)</text>
                          <path d="M750,638 L750,614" stroke={DATA} strokeWidth={1.3} fill="none" markerEnd="url(#wa)" />
                          <text x="762" y="630" fontSize="9" fill="var(--muted)">search</text>
                        </>
                      )}
                      {row.flow === "admin" && (
                        <>
                          <rect x="330" y="536" width="210" height="40" rx="8" fill="none" stroke={ACCENT} strokeWidth={1.6} strokeDasharray="5 4" />
                          <text x="435" y="553" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="10" fontWeight="700" fill={ACCENT}>/admin/knowledge-base</text>
                          <text x="435" y="567" textAnchor="middle" fontSize="9" fill={ACCENT}>(proposed)</text>
                          <path d="M435,526 L435,536" stroke={ACCENT} strokeWidth={1.6} strokeDasharray="4 3" fill="none" markerEnd="url(#waAccent)" />
                          <path d="M540,556 C 600,556 610,562 650,566" stroke={ACCENT} strokeWidth={1.6} strokeDasharray="4 3" fill="none" markerEnd="url(#waAccent)" />
                          <text x="558" y="549" fontSize="9" fill={ACCENT}>embed (Cohere) &#8594; upsert vectors</text>
                        </>
                      )}
                      {row.flow === "help" && (
                        <path d="M540,624 C 610,624 620,730 650,744" stroke={ACCENT} strokeWidth={1.6} strokeDasharray="4 3" fill="none" markerEnd="url(#waAccent)" />
                      )}
                      {row.flow === "help" && <text x="558" y="700" fontSize="9" fill={ACCENT}>search_app_docs (proposed)</text>}
                    </g>
                  ))}

                  {/* Evidence export (own row, triggered from Gate page) */}
                  {visible("evidence") && (
                    <g data-flow="evidence" className={activeClass}>
                      <rect x="330" y="690" width="210" height="52" rx="8" fill={SERVER} fillOpacity={0.08} stroke={SERVER} strokeWidth={1.4} />
                      <text x="435" y="710" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="10" fontWeight="700" fill={SERVER}>.../evidence-export</text>
                      <text x="435" y="726" textAnchor="middle" fontSize="9.5" fill="var(--muted)">evidence-export/route.ts</text>
                      <path d="M230,255 C 275,255 275,700 330,714" stroke="var(--foreground)" strokeWidth={1.1} fill="none" markerEnd="url(#wa)" opacity={0.7} />
                      <text x="283" y="572" fontSize="9" fill="var(--muted)">download evidence</text>
                    </g>
                  )}

                  {/* Server -> Postgres */}
                  {visible("discovery") && <path data-flow="discovery" className={activeClass} d="M540,78 L650,78" stroke={SERVER} strokeWidth={1.2} fill="none" markerEnd="url(#wa)" opacity={0.85} />}
                  {visible("recommendation") && <path data-flow="recommendation" className={activeClass} d="M540,162 L650,140" stroke={SERVER} strokeWidth={1.2} fill="none" markerEnd="url(#wa)" opacity={0.85} />}
                  {visible("gate") && <path data-flow="gate" className={activeClass} d="M540,246 L650,200" stroke={SERVER} strokeWidth={1.2} fill="none" markerEnd="url(#wa)" opacity={0.85} />}
                  {visible("execute") && <path data-flow="execute" className={activeClass} d="M540,330 L650,260" stroke={SERVER} strokeWidth={1.2} fill="none" markerEnd="url(#wa)" opacity={0.85} />}
                  {visible("governance") && <path data-flow="governance" className={activeClass} d="M540,414 L650,340" stroke={SERVER} strokeWidth={1.2} fill="none" markerEnd="url(#wa)" opacity={0.85} />}
                  {visible("admin") && <path data-flow="admin" className={activeClass} d="M540,498 L650,410" stroke={SERVER} strokeWidth={1.2} fill="none" markerEnd="url(#wa)" opacity={0.85} />}
                  {visible("evidence") && <path data-flow="evidence" className={activeClass} d="M540,716 C 600,716 610,480 650,470" stroke={SERVER} strokeWidth={1.2} fill="none" markerEnd="url(#wa)" opacity={0.85} />}

                  {/* Server -> Gateway */}
                  {visible("discovery") && <path data-flow="discovery" className={activeClass} d="M540,70 C 800,70 900,280 960,290" stroke={DATA} strokeWidth={1.2} fill="none" markerEnd="url(#wa)" opacity={0.9} />}
                  {visible("recommendation") && <path data-flow="recommendation" className={activeClass} d="M540,154 C 800,154 900,300 960,305" stroke={DATA} strokeWidth={1.2} fill="none" markerEnd="url(#wa)" opacity={0.9} />}
                  {visible("execute") && <path data-flow="execute" className={activeClass} d="M540,318 C 800,318 900,318 960,318" stroke={DATA} strokeWidth={1.2} fill="none" markerEnd="url(#wa)" opacity={0.9} />}
                  {visible("help") && <path data-flow="help" className={activeClass} d="M540,614 C 800,600 900,340 960,335" stroke={DATA} strokeWidth={1.2} fill="none" markerEnd="url(#wa)" opacity={0.9} />}
                  {visible("discovery recommendation") && <text x="760" y="290" fontSize="9.5" fill="var(--muted)">chat completion</text>}
                </svg>
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CLIENT }} />Client</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SERVER }} />Server / API route</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: DATA }} />Data store / Gateway</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border" style={{ borderColor: ACCENT, background: "var(--tier-medium-bg)" }} />Proposed &mdash; not built yet</span>
              </div>
            </div>
        </div>
      )}
    </>
  );
}
