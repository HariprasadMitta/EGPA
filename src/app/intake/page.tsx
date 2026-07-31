"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { classifyRisk } from "@/lib/governance";
import {
  AutonomyLevel,
  DataSensitivity,
  ExpectedUsers,
  IntegrationSurface,
  Recommendation,
} from "@/types";

const DATA_SENSITIVITY_OPTIONS: { value: DataSensitivity; label: string }[] = [
  { value: "public", label: "Public - no restrictions" },
  { value: "internal", label: "Internal - employees only" },
  { value: "confidential", label: "Confidential - customer/business data" },
  { value: "regulated", label: "Regulated - PII, financial, health, etc." },
];

const AUTONOMY_OPTIONS: { value: AutonomyLevel; label: string }[] = [
  { value: "suggest-only", label: "Suggest only - human does everything" },
  { value: "human-approves-each-action", label: "Human approves each action" },
  { value: "human-approves-batches", label: "Human approves in batches" },
  { value: "fully-autonomous", label: "Fully autonomous" },
];

const INTEGRATION_OPTIONS: { value: IntegrationSurface; label: string }[] = [
  { value: "read-only-internal", label: "Read-only, internal systems" },
  { value: "read-write-internal", label: "Read/write, internal systems" },
  { value: "external-customer-facing", label: "External, customer-facing" },
  {
    value: "external-financial-or-safety",
    label: "External, financial or safety-critical",
  },
];

const EXPECTED_USERS_OPTIONS: { value: ExpectedUsers; label: string }[] = [
  { value: "team", label: "A single team" },
  { value: "department", label: "A department" },
  { value: "org-wide", label: "Org-wide" },
  { value: "external-public", label: "External / public" },
];

export default function IntakePage() {
  const router = useRouter();
  const { createUseCase, setRecommendation } = useStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [businessDomain, setBusinessDomain] = useState("");
  const [dataSensitivity, setDataSensitivity] = useState<DataSensitivity>("internal");
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>("human-approves-each-action");
  const [integrationSurface, setIntegrationSurface] = useState<IntegrationSurface>("read-only-internal");
  const [expectedUsers, setExpectedUsers] = useState<ExpectedUsers>("team");
  const [owner, setOwner] = useState("");
  const [steward, setSteward] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const previewTier = classifyRisk({ dataSensitivity, autonomyLevel, integrationSurface });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !owner.trim() || !steward.trim()) {
      setError("Please fill in title, description, owner, and steward.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const useCase = createUseCase({
      title,
      description,
      businessDomain: businessDomain || "Unspecified",
      dataSensitivity,
      autonomyLevel,
      integrationSurface,
      expectedUsers,
      owner,
      steward,
      riskTier: previewTier,
    });

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          businessDomain,
          dataSensitivity,
          autonomyLevel,
          integrationSurface,
          expectedUsers,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong generating the recommendation.");
        setSubmitting(false);
        return;
      }

      setRemaining(data.remaining ?? null);

      const recommendation: Recommendation = {
        useCaseId: useCase.id,
        framework: data.recommendation.framework,
        tools: data.recommendation.tools,
        harnessPattern: data.recommendation.harnessPattern,
        loopPattern: data.recommendation.loopPattern,
        iterationCeiling: data.recommendation.iterationCeiling,
        contextStrategy: data.recommendation.contextStrategy,
        rationale: data.recommendation.rationale,
        createdAt: new Date().toISOString(),
        version: 1,
      };

      setRecommendation(useCase.id, recommendation);
      router.push("/recommendation");
    } catch {
      setError("Network error calling the recommendation engine. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Use Case Intake</h1>
      <p className="mt-2 text-[var(--muted)]">
        Answer the questionnaire and describe your use case in your own words.
        Risk tier is computed automatically as you fill this in.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <label className="block text-sm font-medium">Use case title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="e.g. Customer complaint triage agent"
          />

          <label className="mt-4 block text-sm font-medium">Business domain</label>
          <input
            value={businessDomain}
            onChange={(e) => setBusinessDomain(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="e.g. Retail Banking - Customer Care"
          />

          <label className="mt-4 block text-sm font-medium">
            Free-text use case description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="Describe what the agent does, what it touches, and who relies on it."
          />
        </div>

        <div className="grid gap-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Data sensitivity classification</label>
            <select
              value={dataSensitivity}
              onChange={(e) => setDataSensitivity(e.target.value as DataSensitivity)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              {DATA_SENSITIVITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">Agent autonomy level</label>
            <select
              value={autonomyLevel}
              onChange={(e) => setAutonomyLevel(e.target.value as AutonomyLevel)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              {AUTONOMY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">Integration surface</label>
            <select
              value={integrationSurface}
              onChange={(e) => setIntegrationSurface(e.target.value as IntegrationSurface)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              {INTEGRATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">Expected user base</label>
            <select
              value={expectedUsers}
              onChange={(e) => setExpectedUsers(e.target.value as ExpectedUsers)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              {EXPECTED_USERS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Business owner</label>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="Name (Role)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Technical steward</label>
            <input
              value={steward}
              onChange={(e) => setSteward(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="Name (Role)"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Live computed risk tier
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Computed from sensitivity &times; autonomy &times; blast radius.
              This is not user-selectable.
            </p>
          </div>
          <span className="text-lg font-bold text-[var(--brand-strong)]">
            {previewTier}
          </span>
        </div>

        {error && (
          <div className="rounded-md border border-[var(--tier-critical)]/30 bg-[var(--tier-critical-bg)] px-4 py-3 text-sm text-[var(--tier-critical)]">
            {error}
          </div>
        )}
        {remaining !== null && (
          <p className="text-xs text-[var(--muted)]">
            {remaining} free live recommendation{remaining === 1 ? "" : "s"} remaining this hour.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Calling recommendation engine..." : "Get recommendation"}
        </button>
      </form>
    </div>
  );
}
