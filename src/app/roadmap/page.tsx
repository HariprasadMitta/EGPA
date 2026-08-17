import Link from "next/link";

interface RoadmapItem {
  title: string;
  detail: string;
}

interface RoadmapGroup {
  label: string;
  blurb: string;
  items: RoadmapItem[];
}

// Real, honest backlog - every item here is something not yet built, kept
// in the same terms used to track it internally rather than dressed up.
// No dates: a real single-team roadmap can't credibly commit to a quarter,
// so items are grouped by rough sequencing instead.
const GROUPS: RoadmapGroup[] = [
  {
    label: "Next",
    blurb: "Deepens governance itself - the highest-value gap for an org running this for real.",
    items: [
      { title: "Governance templates per regulatory regime", detail: "Today's risk-tier controls are one fixed set. Real orgs need different required-control sets for, say, GDPR vs. a purely internal tool." },
      { title: "Configurable PII patterns per org/region", detail: "PII detection is currently a fixed regex set (including a South African ID pattern). Real orgs in other jurisdictions need their own patterns configurable, not hardcoded." },
      { title: "Regulatory citation mapping", detail: "Required controls don't yet cite the specific regulation or clause driving them - real audit evidence needs that traceability." },
      { title: "Incident workflow tied to the kill-switch", detail: "Engaging the kill-switch is real and enforced; there's no structured incident record (severity, resolution, post-mortem) attached to why it was engaged." },
      { title: "Aggregate portfolio risk rollup", detail: "Risk tier is real per use case; there's no single view of the org's total risk exposure across every use case at once." },
    ],
  },
  {
    label: "Later",
    blurb: "Extends the pipeline's reach once the governance core above is in place.",
    items: [
      { title: "Intake templates", detail: "Every Intake starts blank today. Common use-case shapes (a triage agent, a document classifier) could pre-fill the questionnaire." },
      { title: "Reference architecture templates", detail: "Recommendation always generates fresh; a library of pre-approved reference architectures for common patterns would speed up the common case." },
      { title: "Vendor/model blast-radius reverse lookup", detail: "\"If this model or vendor is compromised or deprecated, which use cases are affected?\" isn't answerable today without checking every use case by hand." },
      { title: "Data-source registry + blast radius", detail: "Same gap as above, for data sources rather than models - which use cases touch a given system." },
      { title: "Configurable approval workflows per org", detail: "The gate's approval sequence is fixed. A federated org may want different sign-off chains for different business units." },
      { title: "In-app notification center", detail: "Slack notifications are real and working; there's no in-app equivalent for someone who doesn't have Slack wired up." },
    ],
  },
  {
    label: "Platform hardening",
    blurb: "Not user-facing capability - the work that makes this credible as production infrastructure rather than a working prototype.",
    items: [
      { title: "Broader e2e/integration test coverage", detail: "Real unit tests exist for core logic (risk scoring, audit chain, policy checks); the full pipeline isn't yet covered end to end." },
      { title: "Accessibility audit and fixes", detail: "Built with real semantic HTML and keyboard-reachable controls throughout, but never run through a formal audit." },
      { title: "OpenAPI spec for the public API", detail: "The preflight-check and actual-usage-report endpoints are real and documented in prose; no machine-readable spec yet." },
      { title: "SCIM / automated user provisioning", detail: "Users are created via signup or invite today; no automated directory sync for a real enterprise identity provider." },
      { title: "Per-tenant branding", detail: "Multi-tenancy is real and enforced server-side; every tenant currently sees the same EGPA branding, not their own." },
      { title: "First-run interactive tour", detail: "The Guide page is a real, thorough reference, but a new user has to go find it rather than being walked through on first login." },
      { title: "Pagination/performance work on Portfolio and Observability", detail: "Both pages load every row today - fine at current volume, a real gap at genuine enterprise scale." },
      { title: "Placeholder Privacy Policy / ToS / DPA", detail: "No legal documents exist yet - needed before any real production deployment, not before a demo one." },
    ],
  },
];

export default function RoadmapPage() {
  const totalItems = GROUPS.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Roadmap</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        {`A real, current backlog of ${totalItems} items not yet built - the same list used to track this platform's own development, not a curated subset written for this page. No dates: a real single-team roadmap can't credibly commit to a quarter, so items are grouped by rough sequencing instead of promised timing.`}
      </p>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">What&apos;s already real, today</h2>
        <p className="mt-2 text-sm text-[var(--foreground)]">
          The full pipeline (Discovery through Observability), real runtime governance (kill-switch, audit
          trail, tool allowlist, PII redaction), real multi-tenancy and SSO, a real AI Gateway with
          multi-provider fallback, and the declared-vs-actual reconciliation + preflight-check APIs for
          agents built outside this platform. See the{" "}
          <Link href="/guide" className="font-medium text-[var(--brand)] hover:underline">
            Guide
          </Link>{" "}
          for the full list of what&apos;s live.
        </p>
      </div>

      <div className="mt-10 space-y-10">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <h2 className="text-lg font-bold text-[var(--brand-strong)]">{group.label}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{group.blurb}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {group.items.map((item) => (
                <div key={item.title} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
                  <p className="mt-1.5 text-xs text-[var(--muted)]">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-10 text-xs text-[var(--muted)]">
        Have a use case that needs one of these sooner? Reach out through your organization&apos;s EGPA
        contact - this backlog is sequenced by what strengthens governance depth first, but real demand
        can reorder it.
      </p>
    </div>
  );
}
