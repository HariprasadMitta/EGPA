"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CONTEXT_STRATEGIES,
  FRAMEWORKS,
  HARNESS_PATTERNS,
  LOOP_PATTERNS,
  MCP_EXPLAINER,
  CatalogEntry,
} from "@/lib/patternLibrary";
import { ROLE_LABELS } from "@/lib/roles";

function LayersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" strokeLinejoin="round" />
      <path d="M3 12l9 5 9-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 16l9 5 9-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HarnessIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5">
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.2 11.1 15.8 6.9M8.2 12.9l7.6 4.2" strokeLinecap="round" />
    </svg>
  );
}

function LoopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5">
      <path d="M4 12a8 8 0 0 1 13.5-5.8" strokeLinecap="round" />
      <path d="M20 12a8 8 0 0 1-13.5 5.8" strokeLinecap="round" />
      <path d="M17 3v3.5H13.5M7 21v-3.5h3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ContextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5">
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M3.5 10h17M9 10v9" strokeLinecap="round" />
    </svg>
  );
}

function ProtocolIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
      <path d="M7.5 11v3a2 2 0 0 0 2 2h3" strokeLinecap="round" />
    </svg>
  );
}

interface Category {
  key: string;
  label: string;
  icon: () => React.ReactElement;
  blurb: string;
  entries: CatalogEntry[];
}

interface RoadmapStep {
  n: number;
  title: string;
  description: string;
  role: string;
  href: string;
}

const ROADMAP: RoadmapStep[] = [
  {
    n: 1,
    title: "Intake",
    description:
      "Answer the structured questionnaire and describe the use case in free text. Nothing here is optional - the risk tier is computed from these answers.",
    role: ROLE_LABELS.requester,
    href: "/intake",
  },
  {
    n: 2,
    title: "Recommendation",
    description:
      "A real LLM call proposes a framework, tool stack, harness pattern, loop pattern, and context strategy - plus the architecture diagram of the master agent and its sub-agents.",
    role: ROLE_LABELS.steward,
    href: "/recommendation",
  },
  {
    n: 3,
    title: "Governance Gate",
    description:
      "The required controls for the computed risk tier must all be acknowledged before anything can proceed - enforced, not advisory.",
    role: ROLE_LABELS["governance-owner"],
    href: "/gate",
  },
  {
    n: 4,
    title: "ADR",
    description:
      "A versioned Architecture Decision Record is assembled automatically from everything decided so far - downloadable and traceable.",
    role: ROLE_LABELS["governance-owner"],
    href: "/adr",
  },
  {
    n: 5,
    title: "Execution",
    description:
      "Developers get single-sign-on access to actually run the approved architecture: a master agent plans, then real sub-agent LLM calls execute each step.",
    role: ROLE_LABELS.developer,
    href: "/execution",
  },
  {
    n: 6,
    title: "Observability",
    description:
      "Real token/cost/duration usage and a real step-by-step decision trace from every execution, all in one dashboard - nothing simulated.",
    role: "All roles",
    href: "/dashboard",
  },
];

const CATEGORIES: Category[] = [
  {
    key: "frameworks",
    label: "Frameworks",
    icon: LayersIcon,
    blurb: "The orchestration layer a recommendation's Master Agent runs on.",
    entries: FRAMEWORKS,
  },
  {
    key: "harness",
    label: "Harness patterns",
    icon: HarnessIcon,
    blurb: "How the agent(s) are structured relative to human oversight and each other.",
    entries: HARNESS_PATTERNS,
  },
  {
    key: "loop",
    label: "Loop patterns",
    icon: LoopIcon,
    blurb: "The control loop shape driving each step of execution.",
    entries: LOOP_PATTERNS,
  },
  {
    key: "context",
    label: "Context strategies",
    icon: ContextIcon,
    blurb: "How context window usage is managed as a loop runs.",
    entries: CONTEXT_STRATEGIES,
  },
];

function DisclosureCard({ entry, index, open, onToggle }: { entry: CatalogEntry; index: number; open: boolean; onToggle: () => void }) {
  return (
    <div
      className="fade-slide-up overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] transition-all hover:-translate-y-0.5 hover:border-[var(--accent)]/50 hover:shadow-md"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div>
          <p className="text-sm font-semibold">{entry.name}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{entry.description}</p>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`h-4 w-4 flex-none text-[var(--muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className={`disclosure-body ${open ? "open" : ""}`}>
        <div>
          <p className="px-4 pb-4 text-xs">
            <span className="font-semibold text-[var(--accent)]">When to use: </span>
            <span className="text-[var(--muted)]">{entry.whenToUse}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function PatternLibrary() {
  const [activeKey, setActiveKey] = useState(CATEGORIES[0].key);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const active = CATEGORIES.find((c) => c.key === activeKey) ?? CATEGORIES[0];

  function toggle(entryName: string) {
    const id = `${activeKey}:${entryName}`;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const isActive = c.key === activeKey;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActiveKey(c.key)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon />
              {c.label}
            </button>
          );
        })}
      </div>

      <p key={`${active.key}-blurb`} className="fade-slide-up mt-4 text-sm text-[var(--muted)]">
        {active.blurb}
      </p>

      <div key={active.key} className="mt-4 grid gap-4 sm:grid-cols-2">
        {active.entries.map((entry, i) => (
          <DisclosureCard
            key={entry.name}
            entry={entry}
            index={i}
            open={expanded.has(`${activeKey}:${entry.name}`)}
            onToggle={() => toggle(entry.name)}
          />
        ))}
      </div>
    </div>
  );
}

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Guide</h1>
      <p className="mt-2 max-w-2xl text-[var(--muted)]">
        Where to start, how the pipeline fits together, and a reference library
        of the architecture patterns and tools this advisor draws from.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-[var(--brand-strong)]">How it works, step by step</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Click any stage to jump straight there.</p>

        <div className="mt-5 space-y-3">
          {ROADMAP.map((step) => (
            <Link
              key={step.n}
              href={step.href}
              className="flex gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:bg-[var(--background)]"
            >
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--brand)] text-sm font-bold text-white">
                {step.n}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-[var(--brand-strong)]">{step.title}</h3>
                  <span className="rounded-full bg-[var(--status-current-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--status-current)]">
                    {step.role}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">{step.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-bold text-[var(--brand-strong)]">Pattern &amp; Tool Library</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          The vocabulary the recommendation engine draws from &mdash; independent
          of any one use case, so you can learn the space on its own terms.
        </p>

        <PatternLibrary />

        <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-shadow hover:shadow-md">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
              <ProtocolIcon />
            </span>
            <h3 className="font-semibold text-[var(--brand-strong)]">{MCP_EXPLAINER.name}</h3>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">{MCP_EXPLAINER.description}</p>
          <ul className="mt-3 list-none space-y-2 text-sm">
            {MCP_EXPLAINER.whyItMatters.map((point, i) => (
              <li
                key={point}
                className="fade-slide-up flex gap-2"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="text-[var(--accent)]">&bull;</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[var(--muted)]">
            <span className="font-semibold text-[var(--tier-medium)]">Tradeoff: </span>
            {MCP_EXPLAINER.tradeoff}
          </p>
          <p className="mt-4 text-sm">
            <Link href="/registry" className="font-semibold text-[var(--accent)]">
              See approved MCP servers in the Model Registry &rarr;
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
