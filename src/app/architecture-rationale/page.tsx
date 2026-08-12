import Link from "next/link";

const QUICK_NAV = [
  { id: "discovery", label: "Problem discovery" },
  { id: "alternatives", label: "Alternative approaches" },
  { id: "tradeoffs", label: "Options & trade-offs" },
  { id: "build-vs-buy", label: "Build vs. buy" },
  { id: "current-target", label: "Current → target state" },
  { id: "phases", label: "Phased implementation" },
  { id: "value", label: "Business value" },
];

interface TradeoffRow {
  dimension: string;
  extend: string;
  buy: string;
  build: string;
}

const TRADEOFFS: TradeoffRow[] = [
  {
    dimension: "Time to value",
    extend: "Fast to start, slow to mean anything — policy docs land in weeks, real enforcement never arrives",
    buy: "Fast — weeks to a working catalog/approval workflow",
    build: "Slower to first value, but each phase ships something real (see phased history below)",
  },
  {
    dimension: "Cost profile",
    extend: "Low license cost, high ongoing manual-review labor cost",
    buy: "Predictable license/seat cost, but scales with usage and rarely covers execution",
    build: "Engineering cost up front, near-zero marginal cost per additional use case after",
  },
  {
    dimension: "Integration complexity",
    extend: "Low — reuses what's already there",
    buy: "Medium — vendor APIs, SSO, usually no execution-layer hook",
    build: "Owned end to end — one data model from Discovery through Observability",
  },
  {
    dimension: "Flexibility",
    extend: "High short-term, brittle long-term — every exception is a spreadsheet column",
    buy: "Bounded by the vendor's model — org-specific risk scoring is often not configurable",
    build: "Full — risk scoring, templates, and workflow are this org's own code",
  },
  {
    dimension: "Operational ownership",
    extend: "Distributed across whichever team owns each existing tool — no single accountable owner",
    buy: "Vendor owns uptime; this org owns configuration and adoption",
    build: "This org owns everything — real commitment, real control",
  },
  {
    dimension: "Regulatory control",
    extend: "Weak — policy exists on paper, nothing stops a non-compliant deploy",
    buy: "Depends entirely on vendor coverage of this org's specific regulatory regime",
    build: "Enforced server-side at runtime — a gate that blocks, not a policy that's requested",
  },
  {
    dimension: "Scalability",
    extend: "Degrades as volume grows — manual review doesn't scale linearly",
    buy: "Scales, but per-seat/per-call cost grows with it",
    build: "Scales with the org's own infrastructure, no per-use-case vendor toll",
  },
];

interface Phase {
  n: string;
  title: string;
  proof: string;
}

const PHASES: Phase[] = [
  { n: "1", title: "Foundation", proof: "Real schema, real Postgres via Prisma — no in-memory mock data from day one." },
  { n: "2", title: "Real authentication", proof: "Auth.js v5 + Prisma — real accounts, not a hardcoded demo user." },
  { n: "3", title: "State off the browser", proof: "Migrated every client bundle off sessionStorage onto the real database — state now survives a hard refresh and is shared across reviewers." },
  { n: "4", title: "Real execution", proof: "LangGraph tool-calling loop + Pinecone/Cohere RAG, real token streaming — proof was watching real tokens arrive with a real cost attached." },
  { n: "5", title: "Live multi-user sync", proof: "SSE broadcast — two signed-in reviewers see the same use case update in real time." },
  { n: "6", title: "Real telemetry", proof: "Removed every simulated dashboard number; Observability became a real query over real execution history." },
  { n: "7", title: "Runtime governance", proof: "Audit log, tool-allowlist enforcement, kill-switch — proof was flipping the kill-switch mid-run and watching the next step genuinely fail to start." },
  { n: "8", title: "Event-triggered execution", proof: "Authenticated webhook — an execution can start from curl or a cron job, zero human clicks." },
  { n: "9–10", title: "Real AI Gateway", proof: "Self-hosted LiteLLM Proxy fronting every LLM call, deployed to Cloud Run — the app stopped holding provider keys directly." },
  { n: "Later", title: "Enterprise hardening + business value", proof: "Multi-tenancy, SSO, real e2e tests, security hardening, then Discovery Advisor, Time Saved / Business Value tracking, Responsible AI controls, Admin Overview, and this page." },
];

export default function ArchitectureRationalePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
        Architecture Decision Record
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[var(--brand-strong)]">Why EGPA</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        <strong>Status:</strong> Implemented and live &mdash; not a proposal.{" "}
        <strong>Scope:</strong> the platform itself, not a use case inside it.
      </p>
      <p className="mt-4 max-w-2xl text-[var(--muted)]">
        Every use case that goes through EGPA is required to document its problem statement,
        the alternatives considered, and why they lost &mdash; before it can be approved. This
        page holds EGPA itself to the same standard. It&apos;s the platform&apos;s own decision
        record, not a marketing page.
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

      <section id="discovery" className="mt-10 scroll-mt-24">
        <h2 className="text-lg font-bold text-[var(--brand-strong)]">Problem discovery &amp; validation</h2>
        <p className="mt-3 text-[var(--muted)]">
          A real rollout would consult the CISO / Head of AI Risk, Enterprise Architecture, Compliance
          &amp; Legal, the business-unit heads who&apos;d actually submit use cases, and the platform
          team who&apos;d operate the Gateway underneath it &mdash; before committing to any of the
          three options below.
        </p>
        <p className="mt-3 text-[var(--muted)]">Three assumptions had to hold before building was justified:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--muted)]">
          <li>
            <strong className="text-[var(--foreground)]">Shadow AI is actually happening.</strong> The
            Model Registry exists specifically to answer &ldquo;what&apos;s the shadow AI running around
            this org&rdquo; instead of guessing &mdash; if there&apos;s nothing to catalog, the registry
            has no reason to exist.
          </li>
          <li>
            <strong className="text-[var(--foreground)]">Business units lack a shared source of truth
            for what&apos;s allowed to run.</strong> If every team already agreed on one model list and
            one risk taxonomy, a federated registry wouldn&apos;t be solving a real problem.
          </li>
          <li>
            <strong className="text-[var(--foreground)]">A discovery gate would actually get used, not
            skipped.</strong> This one has real evidence now, not just an assumption: see the{" "}
            <Link href="/governance" className="font-semibold text-[var(--accent)]">
              Governance Posture
            </Link>{" "}
            page&apos;s &ldquo;Discovery avoided a build&rdquo; metric &mdash; a real percentage of
            concluded Discovery sessions actually talked someone out of building, computed live from
            real sessions, not assumed.
          </li>
        </ul>
      </section>

      <section id="alternatives" className="mt-12 scroll-mt-24">
        <h2 className="text-lg font-bold text-[var(--brand-strong)]">Alternative enterprise approaches</h2>
        <p className="mt-3 text-[var(--muted)]">
          Three genuinely different approaches were considered &mdash; not just alternative
          technologies, alternative ways to solve the organizational problem:
        </p>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="font-semibold text-[var(--foreground)]">A. Extend existing platforms</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Reuse what already exists &mdash; a GRC/ITSM tool (e.g. ServiceNow) for the approval
              workflow, Confluence for policy documentation, a spreadsheet as the model/risk register.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="font-semibold text-[var(--foreground)]">B. Buy an established AI governance product</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Procure and configure a vendor product built for this problem (e.g. an AI governance /
              model-risk-management platform) rather than build one.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="font-semibold text-[var(--foreground)]">C. Build a dedicated platform &mdash; EGPA</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              A purpose-built control plane that covers discovery through execution and observability
              in one governed pipeline, with the org&apos;s own risk taxonomy as policy-as-code.
            </p>
          </div>
        </div>
      </section>

      <section id="tradeoffs" className="mt-12 scroll-mt-24">
        <h2 className="text-lg font-bold text-[var(--brand-strong)]">Options &amp; trade-offs</h2>
        <p className="mt-3 text-[var(--muted)]">The same three options, compared across seven dimensions:</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-[var(--background)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Dimension</th>
                <th className="px-4 py-3">A. Extend existing</th>
                <th className="px-4 py-3">B. Buy a product</th>
                <th className="px-4 py-3">C. Build EGPA</th>
              </tr>
            </thead>
            <tbody>
              {TRADEOFFS.map((row) => (
                <tr key={row.dimension} className="border-t border-[var(--border)] align-top">
                  <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{row.dimension}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.extend}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.buy}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.build}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="build-vs-buy" className="mt-12 scroll-mt-24">
        <h2 className="text-lg font-bold text-[var(--brand-strong)]">Build vs. buy rationale</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--tier-low)]/30 bg-[var(--tier-low-bg)] p-4">
            <h3 className="font-semibold text-[var(--tier-low)]">Build wins when&hellip;</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--foreground)]">
              <li>The org is federated (many business units, no single existing source of truth)</li>
              <li>Governance needs to be enforced at the point of execution, not just documented</li>
              <li>Risk scoring needs to reflect this org&apos;s specific taxonomy, not a vendor&apos;s generic one</li>
              <li>Discovery, intake, execution, and observability need to share one real data model</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--tier-medium)]/30 bg-[var(--tier-medium-bg)] p-4">
            <h3 className="font-semibold text-[var(--tier-medium)]">Buy or extend wins when&hellip;</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--foreground)]">
              <li>The org is small enough that in-house platform engineering isn&apos;t justified</li>
              <li>A regulatory deadline is close and a vendor&apos;s pre-built compliance mappings fit</li>
              <li>The need is cataloging and approval, not real execution/orchestration</li>
              <li>Org AI maturity is early enough that policy-as-document is genuinely sufficient for now</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="current-target" className="mt-12 scroll-mt-24">
        <h2 className="text-lg font-bold text-[var(--brand-strong)]">Current state &rarr; target state</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--tier-critical)]">Current (typical)</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Shadow AI outside any review process. No shared model registry. Risk classification is
              subjective and inconsistent between teams. Sign-off lives on paper or in a spreadsheet,
              disconnected from whatever actually deploys the agent. No audit trail linking business
              justification to the running system.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Transition</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Pilot with one business unit at Low/Medium tier first &mdash; lowest friction, fastest
              feedback. Add Critical-tier ARB workflow once the base pipeline is trusted. Connect the
              Gateway to real production traffic incrementally, team by team. Backfill existing shadow
              AI into the registry as it&apos;s discovered, not via a big-bang audit up front.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--tier-low)]">Target</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              One control plane. Risk tier computed the same way every time. One model/MCP-server
              registry as the single source of truth. A governance gate that blocks progress, not one
              that requests it. A tamper-evident audit trail. Real cost and time saved tracked per use
              case and in aggregate.
            </p>
          </div>
        </div>
      </section>

      <section id="phases" className="mt-12 scroll-mt-24">
        <h2 className="text-lg font-bold text-[var(--brand-strong)]">Phased implementation</h2>
        <p className="mt-3 text-[var(--muted)]">
          This is EGPA&apos;s real build history, not a hypothetical roadmap &mdash; each phase shipped
          with its own concrete proof that it actually worked, not just a claim that it did.
        </p>
        <div className="mt-4 space-y-3">
          {PHASES.map((phase) => (
            <div key={phase.n} className="flex gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-white">
                {phase.n}
              </span>
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">{phase.title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{phase.proof}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="value" className="mt-12 scroll-mt-24">
        <h2 className="text-lg font-bold text-[var(--brand-strong)]">Business value</h2>
        <p className="mt-3 text-[var(--muted)]">
          Every claim below links to where it&apos;s actually computed live &mdash; not a projection
          stated here for effect.
        </p>
        <ul className="mt-4 space-y-2 text-[var(--muted)]">
          <li>
            <strong className="text-[var(--foreground)]">Reduced approval time:</strong> see{" "}
            <Link href="/governance" className="font-semibold text-[var(--accent)]">Governance Posture</Link>&apos;s
            cycle-time-to-production metric.
          </li>
          <li>
            <strong className="text-[var(--foreground)]">Improved reuse:</strong> the &ldquo;Discovery
            avoided a build&rdquo; rate and Model Registry adoption, both on{" "}
            <Link href="/governance" className="font-semibold text-[var(--accent)]">Governance Posture</Link>.
          </li>
          <li>
            <strong className="text-[var(--foreground)]">Lower AI delivery cost:</strong> framework-agnostic
            recommendations avoid re-platforming cost; real per-use-case and portfolio-wide cost tracking
            on{" "}
            <Link href="/dashboard" className="font-semibold text-[var(--accent)]">Observability</Link>.
          </li>
          <li>
            <strong className="text-[var(--foreground)]">Reduced compliance exposure:</strong> real
            &ldquo;compliance exposure caught&rdquo; count (PII detections, undeclared-tool incidents,
            preflight denials, kill-switch engagements) on{" "}
            <Link href="/governance" className="font-semibold text-[var(--accent)]">Governance Posture</Link>.
          </li>
          <li>
            <strong className="text-[var(--foreground)]">Faster movement to production:</strong> Low/Medium
            tier use cases clear governance with far fewer required controls than Critical tier &mdash; by
            design, not by accident &mdash; see the{" "}
            <Link href="/guide#concepts" className="font-semibold text-[var(--accent)]">Guide&apos;s risk-tier explainer</Link>.
          </li>
        </ul>
      </section>
    </div>
  );
}
