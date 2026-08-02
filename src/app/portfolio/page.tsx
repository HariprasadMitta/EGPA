"use client";

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { RiskBadge } from "@/components/RiskBadge";
import { PipelineTrain, PipelineTrainLegend } from "@/components/PipelineTrain";
import { UseCaseStatus } from "@/types";

const STATUS_LABELS: Record<UseCaseStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  recommended: "Recommended",
  gated: "Awaiting sign-off",
  approved: "Approved",
  executing: "Executing",
  executed: "Executed",
};

const STATUS_STYLES: Record<UseCaseStatus, string> = {
  draft: "bg-[var(--background)] text-[var(--muted)]",
  submitted: "bg-[var(--tier-medium-bg)] text-[var(--tier-medium)]",
  recommended: "bg-[var(--tier-medium-bg)] text-[var(--tier-medium)]",
  gated: "bg-[var(--tier-high-bg)] text-[var(--tier-high)]",
  approved: "bg-[var(--tier-low-bg)] text-[var(--tier-low)]",
  executing: "bg-[var(--tier-high-bg)] text-[var(--tier-high)]",
  executed: "bg-[var(--tier-low-bg)] text-[var(--tier-low)]",
};

export default function PortfolioPage() {
  const router = useRouter();
  const { bundles, setActiveId } = useStore();

  function open(id: string) {
    setActiveId(id);
    router.push("/recommendation");
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Use Case Portfolio</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">
            Every use case submitted this session, across business units, with
            its computed risk tier, governance status, and pipeline progress
            &mdash; click any point on a pipeline to jump straight to that
            stage for that use case.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/api/reports/portfolio-csv"
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-sm font-medium hover:bg-[var(--background)]"
          >
            Export CSV
          </a>
          <PipelineTrainLegend />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--background)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Use case</th>
              <th className="px-4 py-3">Business domain</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Risk tier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Pipeline</th>
            </tr>
          </thead>
          <tbody>
            {bundles.map((b) => (
              <tr
                key={b.useCase.id}
                onClick={() => open(b.useCase.id)}
                className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]"
              >
                <td className="px-4 py-3 font-semibold">{b.useCase.title}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{b.useCase.businessDomain}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{b.useCase.owner}</td>
                <td className="px-4 py-3">
                  <RiskBadge tier={b.useCase.riskTier} />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[b.useCase.status]}`}
                  >
                    {STATUS_LABELS[b.useCase.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <PipelineTrain bundle={b} />
                </td>
              </tr>
            ))}
            {bundles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  No use cases yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
