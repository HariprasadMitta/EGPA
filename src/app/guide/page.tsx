"use client";

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

function CatalogSection({ title, blurb, entries }: { title: string; blurb: string; entries: CatalogEntry[] }) {
  return (
    <div className="mt-6">
      <h3 className="font-semibold text-[var(--brand-strong)]">{title}</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">{blurb}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {entries.map((entry) => (
          <div key={entry.name} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <p className="text-sm font-semibold">{entry.name}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{entry.description}</p>
            <p className="mt-2 text-xs">
              <span className="font-semibold text-[var(--accent)]">When to use: </span>
              <span className="text-[var(--muted)]">{entry.whenToUse}</span>
            </p>
          </div>
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

        <CatalogSection
          title="Frameworks"
          blurb="The orchestration layer a recommendation's Master Agent runs on."
          entries={FRAMEWORKS}
        />
        <CatalogSection
          title="Harness patterns"
          blurb="How the agent(s) are structured relative to human oversight and each other."
          entries={HARNESS_PATTERNS}
        />
        <CatalogSection
          title="Loop patterns"
          blurb="The control loop shape driving each step of execution."
          entries={LOOP_PATTERNS}
        />
        <CatalogSection
          title="Context strategies"
          blurb="How context window usage is managed as a loop runs."
          entries={CONTEXT_STRATEGIES}
        />

        <div className="mt-6">
          <h3 className="font-semibold text-[var(--brand-strong)]">{MCP_EXPLAINER.name}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{MCP_EXPLAINER.description}</p>
          <ul className="mt-3 list-none space-y-2 text-sm">
            {MCP_EXPLAINER.whyItMatters.map((point) => (
              <li key={point} className="flex gap-2">
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
