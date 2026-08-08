"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { RiskBadge } from "@/components/RiskBadge";
import { PipelineTrain } from "@/components/PipelineTrain";
import { GOVERNANCE_TEMPLATES } from "@/lib/governance";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";

const OSCAR_LABELS: Record<string, string> = {
  approvals: "O - Ownership / S - Stewardship",
  controls: "A - Auditability",
  hitl: "C - Classification-driven HITL",
};

export default function RecommendationPage() {
  const { active } = useStore();

  if (!active || !active.recommendation) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--brand-strong)]">
          No use case selected yet
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Submit a use case or open a sample from the landing page first.
        </p>
        <Link
          href="/intake"
          className="mt-6 inline-block rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Go to intake
        </Link>
      </div>
    );
  }

  const { useCase, recommendation } = active;
  const template = GOVERNANCE_TEMPLATES[useCase.riskTier];

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-strong)]">{useCase.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{useCase.businessDomain}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <RiskBadge tier={useCase.riskTier} />
          <PipelineTrain bundle={active} />
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-[var(--foreground)]">{useCase.description}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Recommended architecture
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[var(--muted)]">Framework</dt>
              <dd className="font-semibold">{recommendation.framework}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Tool stack</dt>
              <dd className="flex flex-wrap gap-1.5 mt-1">
                {recommendation.tools.map((tool) => (
                  <span
                    key={tool}
                    className="rounded-full border border-[var(--border)] bg-[var(--background)] px-2.5 py-0.5 text-xs"
                  >
                    {tool}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Harness pattern</dt>
              <dd className="font-semibold">{recommendation.harnessPattern}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Loop pattern</dt>
              <dd className="font-semibold">
                {recommendation.loopPattern}{" "}
                <span className="font-normal text-[var(--muted)]">
                  (ceiling: {recommendation.iterationCeiling} iterations)
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Context window strategy</dt>
              <dd className="font-semibold">{recommendation.contextStrategy}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Rationale
          </h2>
          <p className="mt-4 text-sm leading-relaxed">{recommendation.rationale}</p>

          <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Alternatives considered
          </h3>
          <p className="mt-2 text-sm leading-relaxed">
            {recommendation.alternativesConsidered ?? "Not captured for this recommendation."}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Architecture diagram
        </h2>
        <p className="mt-1 mb-6 text-xs text-[var(--muted)]">
          Master agent and the sub-agents it dispatches for this use case. Click any node for details.
        </p>
        <ArchitectureDiagram recommendation={recommendation} />
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            OSCAR governance checklist &mdash; {useCase.riskTier} tier
          </h2>
          <span className="text-xs text-[var(--muted)]">
            Template v{template.version}
            {template.supersedes ? ` (supersedes v${template.supersedes})` : ""}
          </span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-[var(--muted)]">
              {OSCAR_LABELS.approvals}
            </p>
            <ul className="mt-2 list-none space-y-1 text-sm">
              {template.requiredApprovals.map((a) => (
                <li key={a}>&bull; {a}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--muted)]">
              {OSCAR_LABELS.controls}
            </p>
            <ul className="mt-2 list-none space-y-1 text-sm">
              {template.requiredControls.map((c) => (
                <li key={c}>&bull; {c}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 text-xs text-[var(--muted)]">
          {OSCAR_LABELS.hitl}: <strong>{template.hitlTier}</strong>. These
          requirements are mandatory for this tier &mdash; not optional
          checkboxes.
        </p>
      </div>

      <div className="mt-8 flex justify-end">
        <Link
          href="/gate"
          className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-strong)]"
        >
          Proceed to governance gate &rarr;
        </Link>
      </div>
    </div>
  );
}
