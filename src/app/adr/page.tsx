"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { RiskBadge } from "@/components/RiskBadge";

export default function ADRPage() {
  const { active, generateADR } = useStore();
  const [copied, setCopied] = useState(false);

  const useCaseId = active?.useCase.id;
  const hasAdr = Boolean(active?.adr);
  const gateAcknowledged = Boolean(active?.gate?.acknowledged);
  const generatedFor = useRef<string | null>(null);

  useEffect(() => {
    // Guard against React StrictMode's dev-only double-invocation of
    // effects, which would otherwise call generateADR twice on first mount
    // and bump the version number twice for a single real generation.
    if (useCaseId && gateAcknowledged && !hasAdr && generatedFor.current !== useCaseId) {
      generatedFor.current = useCaseId;
      generateADR(useCaseId);
    }
  }, [useCaseId, gateAcknowledged, hasAdr, generateADR]);

  if (!active) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--brand-strong)]">
          No ADR to show yet
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Submit a use case and clear its governance gate first.
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

  if (!active.gate?.acknowledged) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--brand-strong)]">
          Governance gate not yet cleared
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          The ADR is generated once all required controls for this use case
          are acknowledged.
        </p>
        <Link
          href="/gate"
          className="mt-6 inline-block rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Go to governance gate
        </Link>
      </div>
    );
  }

  if (!active.adr) {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-center text-[var(--muted)]">Assembling ADR&hellip;</div>;
  }

  const { useCase, adr } = active;

  function handleCopy() {
    if (!active?.adr) return;
    navigator.clipboard.writeText(active.adr.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!active?.adr) return;
    const blob = new Blob([active.adr.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ADR-${active.useCase.id}-v${active.adr.version}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-strong)]">
            Architecture Decision Record
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {useCase.title} &middot; v{adr.version}
          </p>
        </div>
        <RiskBadge tier={useCase.riskTier} />
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleCopy}
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--background)]"
        >
          {copied ? "Copied!" : "Copy to clipboard"}
        </button>
        <button
          onClick={handleDownload}
          className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-strong)]"
        >
          Download .md
        </button>
      </div>

      <pre className="mt-6 whitespace-pre-wrap rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 font-mono text-xs leading-relaxed">
        {adr.content}
      </pre>

      <div className="mt-8 flex justify-end">
        <Link
          href="/portfolio"
          className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-strong)]"
        >
          View portfolio &rarr;
        </Link>
      </div>
    </div>
  );
}
