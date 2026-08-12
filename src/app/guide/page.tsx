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
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/roles";
import { UserRole } from "@/types";

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
    title: "Discovery Advisor",
    description:
      "Optional, but where a real business problem should start - before anyone jumps to \"we need an AI agent.\" A real, persisted chat that asks clarifying questions, calls a real search_existing_use_cases tool to check whether something already covers the need, and concludes with a reasoned recommendation: process-only (no agent warranted), extend-existing (reuse what's already there), research-first (investigate before committing), or build. A \"build\" conclusion generates a detailed, submission-ready problem statement and suggested title, then hands both straight into Intake with one click - pre-filled, not re-typed.",
    role: "Anyone signed in",
    href: "/discovery",
  },
  {
    n: 2,
    title: "Intake",
    description:
      "Two steps. First, fill in the title, description, owner, and steward, then choose the 4 core questionnaire options (data sensitivity, autonomy level, integration surface, expected users) - a preliminary risk tier updates as you go - and click \"Continue.\" Second, the Risk & Compliance Profile page: a deeper due-diligence questionnaire where two answers (human oversight frequency, customer-impact decision) visibly move the live risk tier via a gauge, before \"Get recommendation\" creates the real use case and calls the recommendation engine.",
    role: ROLE_LABELS.requester,
    href: "/intake",
  },
  {
    n: 3,
    title: "Recommendation",
    description:
      "A real LLM call proposes a framework, tool stack, harness pattern, loop pattern, and context strategy, plus a clickable architecture diagram (click the Master Agent or any sub-agent for its role), the alternatives it considered and why they were passed over, and a read-only preview of the OSCAR governance checklist this risk tier requires. Click \"Proceed to governance gate\" to continue.",
    role: ROLE_LABELS.steward,
    href: "/recommendation",
  },
  {
    n: 4,
    title: "Governance Gate",
    description:
      "Check off every required control for this risk tier - all of them, not a subset, before \"Proceed to ADR\" unlocks. Critical-tier use cases also need a named ARB member to state real written reasoning and click \"Approve as {name}\" here - no one else can clear that specific box, and a bare approval isn't enough. A Governance Owner or Admin can also engage the kill-switch here at any time, real and enforced: flipping it blocks the next in-progress execution step server-side, not just in the UI.",
    role: ROLE_LABELS["governance-owner"],
    href: "/gate",
  },
  {
    n: 5,
    title: "ADR",
    description:
      "A versioned Architecture Decision Record assembles automatically from everything decided so far the moment the gate clears. Use \"Copy to clipboard\" or \"Download .md\" to take it with you, or \"View portfolio\" to move on.",
    role: ROLE_LABELS["governance-owner"],
    href: "/adr",
  },
  {
    n: 6,
    title: "Agentic System",
    description:
      "Developer/Admin-only. Click \"Run execution\" to watch a real master agent plan the steps, then real sub-agent LLM calls execute each one live (tokens streaming in as they're generated, real cost) - with a live two-node diagram showing exactly which node is active. Each sub-agent has exactly one real callable tool, a genuine knowledge-base RAG lookup; the other tool names on a plan (a CRM, a ticketing system) are the recommendation's descriptive label for what a production build would call, not a live integration - see the page's own caveat for the precise boundary. The Automation trigger panel here lets you generate a real webhook token so an execution can start from a curl call or a real cron service instead of a click.",
    role: ROLE_LABELS.developer,
    href: "/execution",
  },
  {
    n: 7,
    title: "Observability",
    description:
      "Portfolio-wide stat tiles, real time-series and by-model/by-tool/by-risk-tier charts, and an expandable execution history across every use case, plus this one use case's own token/cost/duration usage and step-by-step decision trace - nothing simulated. This is the real answer to \"is this agent costing more than the person doing the work\" - actual cost trends, not a guess. Also shows your Model Builder connection status if you're a Developer/Admin.",
    role: "All roles",
    href: "/dashboard",
  },
];

interface RoleGuide {
  role: UserRole;
  pages: string;
  benefit: string;
}

const ROLE_GUIDE: RoleGuide[] = [
  {
    role: "requester",
    pages: "Intake, Portfolio, Recommendation, ADR (read)",
    benefit: "Turn a business idea into a governed, documented AI use case without needing to know AI architecture yourself - submit a description and get a real recommendation back.",
  },
  {
    role: "steward",
    pages: "Recommendation, Portfolio, Guide (pattern library)",
    benefit: "Validate the recommended framework and tool stack against real technical constraints before it goes to governance sign-off - the pattern library gives you the vocabulary to do that quickly.",
  },
  {
    role: "governance-owner",
    pages: "Governance Gate, ADR, Portfolio",
    benefit: "Enforce that the required controls for a given risk tier are actually satisfied, not just acknowledged in spirit - and can halt a running execution in real time via the kill-switch if something goes wrong.",
  },
  {
    role: "developer",
    pages: "Agentic System, Model Builder, Observability",
    benefit: "The only role that can actually run an approved use case and watch a real multi-agent execution happen, or wire up a webhook so it can start itself.",
  },
  {
    role: "arb",
    pages: "Governance Gate (Critical tier only)",
    benefit: "The one sign-off no one else can substitute for on Critical-tier use cases - a real named-reviewer control, not a rubber stamp.",
  },
  {
    role: "admin",
    pages: "Everything above",
    benefit: "Full access for testing or demoing the whole pipeline end to end as any role would experience it.",
  },
];

interface BeyondPageGuide {
  title: string;
  href: string;
  access: string;
  description: string;
}

const BEYOND_PIPELINE: BeyondPageGuide[] = [
  {
    title: "Portfolio",
    href: "/portfolio",
    access: "Signed in",
    description:
      "Every use case ever submitted, across business units, in one table - real risk tier, real status, and a pipeline-progress row you can click at any point to jump straight to that use case's stage. This is also how you get back to a use case you left mid-flow.",
  },
  {
    title: "Model Registry",
    href: "/registry",
    access: "Signed in",
    description:
      "The single source of truth for what's allowed to run: a searchable, filterable catalog of models and MCP servers with their approval status and which risk tiers they're allowed for - the answer to \"visualize the shadow AI running around this org\" instead of guessing. Seeded sample data today - in a connected deployment this would sync live from the AI Gateway's model allowlist.",
  },
  {
    title: "Model Builder",
    href: "/mlops",
    access: "Developer / Admin",
    description:
      "Connect your own free-tier OpenRouter or Hugging Face account (real OAuth, no key ever pasted in), Ping either one to check it's actually reachable, and try a small real RAG demo - paste text, it's really embedded and chunked, then ask a question and get real cosine-similarity retrieval back.",
  },
  {
    title: "Why EGPA",
    href: "/architecture-rationale",
    access: "All roles",
    description:
      "EGPA's own architecture decision record - the problem discovery, the alternative enterprise approaches actually considered, the options/trade-offs and build-vs-buy reasoning, the current-to-target transition, and the real phased build history, held to the same standard every use case inside EGPA is.",
  },
];

interface ConceptGuide {
  title: string;
  tag: string;
  description: string;
  href: string;
  linkLabel: string;
}

const CONCEPTS: ConceptGuide[] = [
  {
    title: "Risk tier scoring (OSCAR)",
    tag: "Computed, not chosen",
    description:
      "Every use case's risk tier (Low/Medium/High/Critical) is computed from your Intake answers - data sensitivity x autonomy level x integration surface, plus (once the deeper risk profile is answered) human oversight frequency and whether the agent directly influences a customer decision. Policy as code: the rule lives in one function, not a reviewer's judgment call, so it's applied the same way every time.",
    href: "/intake",
    linkLabel: "See it compute live on Intake",
  },
  {
    title: "HITL tier",
    tag: "Sets the human checkpoint",
    description:
      "How much a human needs to be in the loop for this use case, from \"none\" up to \"manual\" (every action needs a human). Set by the risk tier's governance template, shown on the Gate page.",
    href: "/gate",
    linkLabel: "See it on the Governance Gate",
  },
  {
    title: "ARB approval",
    tag: "Critical tier only",
    description:
      "A named Review Board member's real sign-off, required before a Critical-tier use case can proceed - the one control only the arb (or admin) role can clear.",
    href: "/gate",
    linkLabel: "See it on the Governance Gate",
  },
  {
    title: "Tool allowlist enforcement",
    tag: "Real, enforced at runtime",
    description:
      "This is the concrete version of \"the agent may have access to everything, so we need tagging that says it's only allowed to read this\": every planned step's tool is checked against the recommendation's approved tool stack, both when the plan is parsed and again when it's persisted. An unlisted tool name is dropped or the whole plan is rejected - not silently trusted.",
    href: "/execution",
    linkLabel: "See it on the Agentic System page",
  },
  {
    title: "Kill-switch",
    tag: "Real, enforced at runtime",
    description:
      "A Governance Owner or Admin can engage this on any use case at any time. It's enforced server-side at the moment the next execution step would run, not just a UI flag - flip it mid-run and the next step genuinely fails to persist.",
    href: "/gate",
    linkLabel: "See it on the Governance Gate",
  },
  {
    title: "Automation trigger (webhook)",
    tag: "Real event triggering",
    description:
      "A Developer/Admin can generate a real bearer token scoped to one use case, then start a real execution from outside the browser - curl, a real cron service, GitHub Actions - with zero human clicking \"Run execution.\" Same governance checks apply either way.",
    href: "/execution",
    linkLabel: "See it on the Agentic System page",
  },
  {
    title: "AI Gateway",
    tag: "Real, local-only",
    description:
      "A self-hosted LiteLLM Proxy sits in front of every real LLM call this app makes, covering the layers a real gateway is expected to own: API management (one endpoint, one virtual key), integration (every provider behind it), model serving and automatic fallback if one fails, and an audit trail feeding this app's own observability and data-governance/security layers. The app itself no longer picks a provider - it holds one scoped virtual key, never the real provider keys.",
    href: "/",
    linkLabel: "See the Control Plane vs. Gateway framing on the landing page",
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

const QUICK_NAV = [
  { id: "roles", label: "Who this is for" },
  { id: "pipeline", label: "How it works" },
  { id: "beyond", label: "Beyond the pipeline" },
  { id: "concepts", label: "Governance concepts" },
  { id: "responsible-ai", label: "Responsible AI" },
  { id: "library", label: "Pattern & Tool Library" },
];

interface ResponsiblePillar {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}

const RESPONSIBLE_AI_PILLARS: ResponsiblePillar[] = [
  {
    title: "Risk-tiered human oversight",
    description:
      "Autonomy is earned, not assumed - the OSCAR risk tier computed from your Intake answers sets the HITL tier (from none up to manual, every action needs a human) and the exact list of controls that must be checked off before anything runs. Critical tier adds a named Architecture Review Board sign-off no one else can substitute for.",
    href: "/gate",
    linkLabel: "See the governance gate",
  },
  {
    title: "Real-time kill-switch",
    description:
      "A Governance Owner or Admin can halt any use case at any time. It's enforced server-side at the moment the next execution step would run, not a UI-only flag - engage it mid-run and the next step genuinely fails to start.",
    href: "/gate",
    linkLabel: "See it on the governance gate",
  },
  {
    title: "PII detection and redaction",
    description:
      "Data-sensitivity controls aren't a checkbox acknowledgment - every sub-agent's real output is scanned for real PII patterns and redacted before it's persisted or shown, with the detection and match count logged, enforced at runtime, not just declared in an intake questionnaire.",
    href: "/gate",
    linkLabel: "See data controls on the governance gate",
  },
  {
    title: "Tamper-evident audit trail",
    description:
      "Every governance action - approvals, kill-switch engagement, control acknowledgments - is hash-chained so a modified or deleted entry is detectable, not just logged. A \"Verify chain\" action on the governance gate recomputes every hash live and reports exactly which entry broke, if any.",
    href: "/gate",
    linkLabel: "See the governance gate's audit log",
  },
  {
    title: "Reasoning required on every decision",
    description:
      "A governance approval isn't a bare click - Critical-tier sign-off and the recommendation's alternatives-considered both require real written reasoning, captured and shown alongside the decision, not inferred after the fact.",
    href: "/recommendation",
    linkLabel: "See alternatives-considered on a recommendation",
  },
  {
    title: "Segregation of duties",
    description:
      "The person who requested or built a use case is not the one who can approve it - approval roles are checked server-side against the submitter, so self-approval is a rejected request, not a policy on paper.",
    href: "/gate",
    linkLabel: "See it enforced on the governance gate",
  },
];

function RoleCard({ guide, index }: { guide: RoleGuide; index: number }) {
  return (
    <div
      className="fade-slide-up rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--accent)]/50 hover:shadow-md"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-white">
          {ROLE_LABELS[guide.role].slice(0, 1)}
        </span>
        <h3 className="font-semibold text-[var(--brand-strong)]">{ROLE_LABELS[guide.role]}</h3>
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">{ROLE_DESCRIPTIONS[guide.role]}</p>
      <p className="mt-3 text-xs">
        <span className="font-semibold text-[var(--accent)]">Pages you&apos;ll use: </span>
        <span className="text-[var(--muted)]">{guide.pages}</span>
      </p>
      <p className="mt-2 text-xs">
        <span className="font-semibold text-[var(--tier-low)]">Benefit: </span>
        <span className="text-[var(--muted)]">{guide.benefit}</span>
      </p>
    </div>
  );
}

function BeyondCard({ page, index }: { page: BeyondPageGuide; index: number }) {
  return (
    <Link
      href={page.href}
      className="fade-slide-up flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--accent)]/50 hover:shadow-md"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-[var(--brand-strong)]">{page.title}</h3>
        <span className="rounded-full bg-[var(--status-current-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--status-current)]">
          {page.access}
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">{page.description}</p>
    </Link>
  );
}

function ConceptCard({ concept, index }: { concept: ConceptGuide; index: number }) {
  return (
    <div
      className="fade-slide-up rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--accent)]/50 hover:shadow-md"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-[var(--brand-strong)]">{concept.title}</h3>
        <span className="rounded-full bg-[var(--tier-low-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--tier-low)]">
          {concept.tag}
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">{concept.description}</p>
      <Link href={concept.href} className="mt-3 inline-block text-xs font-semibold text-[var(--accent)]">
        {concept.linkLabel} &rarr;
      </Link>
    </div>
  );
}

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Guide</h1>
      <p className="mt-2 max-w-2xl text-[var(--muted)]">
        The one-stop reference: who this is for, what every page and button
        actually does, and the vocabulary the recommendation engine draws
        from. Built for an organization with federated business units - every
        use case is shared across reviewers, not siloed to whoever created it.
      </p>

      <nav className="sticky top-0 z-10 mt-6 flex flex-wrap gap-2 border-y border-[var(--border)] bg-[var(--background)]/95 py-3 backdrop-blur">
        {QUICK_NAV.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <section id="roles" className="mt-10 scroll-mt-20">
        <h2 className="text-lg font-bold text-[var(--brand-strong)]">Who this is for</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Every role sees the same real data - what differs is which pages you can act on.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {ROLE_GUIDE.map((guide, i) => (
            <RoleCard key={guide.role} guide={guide} index={i} />
          ))}
        </div>
      </section>

      <section id="pipeline" className="mt-12 scroll-mt-20">
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

      <section id="beyond" className="mt-12 scroll-mt-20">
        <h2 className="text-lg font-bold text-[var(--brand-strong)]">Beyond the pipeline</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Three more real pages that aren&apos;t part of the linear flow above.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {BEYOND_PIPELINE.map((page, i) => (
            <BeyondCard key={page.href} page={page} index={i} />
          ))}
        </div>
      </section>

      <section id="concepts" className="mt-12 scroll-mt-20">
        <h2 className="text-lg font-bold text-[var(--brand-strong)]">Governance concepts, explained</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          The terms used across the pipeline above, in one place.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {CONCEPTS.map((concept, i) => (
            <ConceptCard key={concept.title} concept={concept} index={i} />
          ))}
        </div>
      </section>

      <section id="responsible-ai" className="mt-12 scroll-mt-20">
        <h2 className="text-lg font-bold text-[var(--brand-strong)]">Responsible AI</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Governance here isn&apos;t a policy document sitting next to the product &mdash; these six
          controls are enforced in the running application, server-side, on every use case that
          passes through it.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RESPONSIBLE_AI_PILLARS.map((pillar, i) => (
            <ConceptCard
              key={pillar.title}
              concept={{ title: pillar.title, tag: "Enforced, not declared", description: pillar.description, href: pillar.href, linkLabel: pillar.linkLabel }}
              index={i}
            />
          ))}
        </div>
      </section>

      <section id="library" className="mt-12 scroll-mt-20">
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
