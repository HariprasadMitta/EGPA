"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { classifyRisk } from "@/lib/governance";
import { INTAKE_DRAFT_KEY, IntakeDraft } from "@/app/intake/page";
import {
  HumanOversightFrequency,
  ModelSourcing,
  Recommendation,
  RiskComplianceDetails,
  RiskTier,
} from "@/types";

const REGULATORY_FRAMEWORKS = ["POPIA", "FSCA Conduct Standards", "FICA", "GDPR", "SARB/Basel"];
const DATA_SOURCES: { value: string; label: string }[] = [
  { value: "internal", label: "Internal systems" },
  { value: "third-party-feed", label: "Third-party feed" },
  { value: "customer-submitted", label: "Customer-submitted" },
];

const TIER_ORDER: RiskTier[] = ["Low", "Medium", "High", "Critical"];

function EyeFullIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6">
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeHalfIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6">
      <path d="M2 12s3.5-4.5 10-4.5S22 12 22 12" strokeLinecap="round" />
      <path d="M2 12s3.5 4.5 10 4.5" strokeLinecap="round" strokeDasharray="2 3" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6">
      <path d="M3 12s3.5-6.5 9-6.5S21 12 21 12" strokeLinecap="round" strokeDasharray="2 3" />
      <path d="M4 16 20 8" strokeLinecap="round" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6">
      <path d="M12 3v18M7 21h10" strokeLinecap="round" />
      <path d="M4 7h6M14 7h6" strokeLinecap="round" />
      <path d="M4 7 2 11.5a2.5 2.5 0 0 0 5 0L4 7ZM20 7l-2 4.5a2.5 2.5 0 0 0 5 0L20 7Z" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6">
      <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function tierColor(tier: RiskTier): string {
  return `var(--tier-${tier.toLowerCase()})`;
}

function RiskGauge({ tier, fraction }: { tier: RiskTier; fraction: number }) {
  // Semi-circle gauge, needle sweeps 0deg (Low, left) to 180deg (Critical, right).
  const angle = -90 + fraction * 180;
  const color = tierColor(tier);
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="h-24 w-44">
        <path d="M10 100 A90 90 0 0 1 190 100" fill="none" stroke="var(--border)" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M10 100 A90 90 0 0 1 190 100"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${fraction * 282.6} 282.6`}
        />
        <g transform={`translate(100 100) rotate(${angle})`}>
          <line x1="0" y1="0" x2="0" y2="-72" stroke="var(--foreground)" strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="100" r="6" fill="var(--foreground)" />
      </svg>
      <p className="-mt-1 text-sm font-bold" style={{ color }}>
        {tier}
      </p>
    </div>
  );
}

function IconOption({
  label,
  icon,
  selected,
  onSelect,
}: {
  label: string;
  icon: React.ReactElement;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-1 flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors ${
        selected
          ? "border-[var(--accent)] bg-[var(--accent)]/10"
          : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)]/50"
      }`}
    >
      <span className={selected ? "text-[var(--accent)]" : "text-[var(--muted)]"}>{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

export default function IntakeRiskProfilePage() {
  const router = useRouter();
  const { createUseCase, setRecommendation } = useStore();

  const [draft, setDraft] = useState<IntakeDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const [regulatoryFrameworks, setRegulatoryFrameworks] = useState<string[]>([]);
  const [dataResidency, setDataResidency] = useState("South Africa");
  const [dataSources, setDataSources] = useState<string[]>(["internal"]);
  const [sensitiveDataElements, setSensitiveDataElements] = useState("");
  const [retentionInputsDays, setRetentionInputsDays] = useState<string>("");
  const [retentionOutputsDays, setRetentionOutputsDays] = useState<string>("");
  const [retentionLogsDays, setRetentionLogsDays] = useState<string>("");
  const [modelSourcing, setModelSourcing] = useState<ModelSourcing>("third-party-api");
  const [modelVendor, setModelVendor] = useState("");
  const [expectedUsageVolume, setExpectedUsageVolume] = useState("");
  const [businessCriticality, setBusinessCriticality] = useState("");
  const [fallbackRollbackPlan, setFallbackRollbackPlan] = useState("");

  const [humanOversightFrequency, setHumanOversightFrequency] = useState<HumanOversightFrequency>("full-review");
  const [humanReviewSamplePercent, setHumanReviewSamplePercent] = useState<string>("");
  const [customerImpactDecision, setCustomerImpactDecision] = useState(false);
  const [escalationOwner, setEscalationOwner] = useState("");
  const [accountableOwner, setAccountableOwner] = useState("");
  const [explainabilityRequirement, setExplainabilityRequirement] = useState("");
  const [biasFairnessTestingPlan, setBiasFairnessTestingPlan] = useState("");
  const [preProductionValidation, setPreProductionValidation] = useState("");
  const [usersToldAboutAi, setUsersToldAboutAi] = useState(true);

  const [encryptedAtRestInTransit, setEncryptedAtRestInTransit] = useState(true);
  const [agentWriteAccessProduction, setAgentWriteAccessProduction] = useState(false);
  const [securityReviewCompleted, setSecurityReviewCompleted] = useState(false);

  useEffect(() => {
    // One-time read of the draft stashed by /intake - same post-mount
    // hydration pattern as store.tsx's activeId (sessionStorage isn't
    // available during SSR, so this can't be initial state).
    const raw = window.sessionStorage.getItem(INTAKE_DRAFT_KEY);
    if (!raw) {
      router.replace("/intake");
      return;
    }
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(JSON.parse(raw) as IntakeDraft);
    } catch {
      router.replace("/intake");
    }
  }, [router]);

  const previewTier = useMemo(() => {
    if (!draft) return "Low" as RiskTier;
    return classifyRisk({
      dataSensitivity: draft.dataSensitivity,
      autonomyLevel: draft.autonomyLevel,
      integrationSurface: draft.integrationSurface,
      humanOversightFrequency,
      customerImpactDecision,
    });
  }, [draft, humanOversightFrequency, customerImpactDecision]);

  const gaugeFraction = TIER_ORDER.indexOf(previewTier) / (TIER_ORDER.length - 1);

  const pushExplanation = useMemo(() => {
    const reasons: string[] = [];
    if (humanOversightFrequency === "exception-only") reasons.push("exception-only human review");
    else if (humanOversightFrequency === "sampled") reasons.push("sampled (not full) human review");
    if (customerImpactDecision) reasons.push("directly influencing a customer decision");
    if (reasons.length === 0) {
      return "Full human review and no direct customer-impact decision keep these two answers from raising the tier.";
    }
    return `${reasons.join(" and ")} ${reasons.length > 1 ? "are" : "is"} pushing the tier toward ${previewTier}.`;
  }, [previewTier, humanOversightFrequency, customerImpactDecision]);

  function toggleInArray(list: string[], value: string, setList: (v: string[]) => void) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSubmitting(true);
    setError(null);

    const riskComplianceDetails: Omit<RiskComplianceDetails, "useCaseId" | "createdAt"> = {
      regulatoryFrameworks,
      dataResidency: dataResidency || "Unspecified",
      dataSources,
      sensitiveDataElements: sensitiveDataElements || "Not specified",
      retentionInputsDays: retentionInputsDays ? Number(retentionInputsDays) : null,
      retentionOutputsDays: retentionOutputsDays ? Number(retentionOutputsDays) : null,
      retentionLogsDays: retentionLogsDays ? Number(retentionLogsDays) : null,
      modelSourcing,
      modelVendor: modelVendor || "Not specified",
      customerImpactDecision,
      humanOversightFrequency,
      humanReviewSamplePercent: humanReviewSamplePercent ? Number(humanReviewSamplePercent) : null,
      escalationOwner: escalationOwner || draft.owner,
      explainabilityRequirement: explainabilityRequirement || "Not specified",
      biasFairnessTestingPlan: biasFairnessTestingPlan || "Not specified",
      preProductionValidation: preProductionValidation || "Not specified",
      expectedUsageVolume: expectedUsageVolume || "Not specified",
      businessCriticality: businessCriticality || "Not specified",
      fallbackRollbackPlan: fallbackRollbackPlan || "Not specified",
      encryptedAtRestInTransit,
      agentWriteAccessProduction,
      securityReviewCompleted,
      accountableOwner: accountableOwner || draft.owner,
      usersToldAboutAi,
    };

    try {
      const useCase = await createUseCase(
        { ...draft, riskTier: previewTier },
        riskComplianceDetails
      );

      if (draft.discoverySessionId) {
        // Best-effort link-back to the Discovery session this problem
        // statement came from - not blocking, since a real UseCase already
        // exists at this point regardless of whether this linkage succeeds.
        fetch(`/api/discovery-sessions/${draft.discoverySessionId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ handedOffUseCaseId: useCase.id }),
        }).catch(() => {});
      }

      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
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
        alternativesConsidered: data.recommendation.alternativesConsidered,
        createdAt: new Date().toISOString(),
        version: 1,
      };
      await setRecommendation(useCase.id, recommendation);
      window.sessionStorage.removeItem(INTAKE_DRAFT_KEY);
      router.push("/recommendation");
    } catch (err) {
      setError((err as Error).message || "Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (!draft) return null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Risk &amp; Compliance Profile</h1>
      <p className="mt-2 text-[var(--muted)]">
        Step 2 of 2, for <strong>{draft.title}</strong>. This is where the use case actually
        gets created - two of these answers below directly raise or hold the computed risk tier.
      </p>

      <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-[var(--accent)]/30 bg-[var(--surface)] p-6 sm:flex-row sm:justify-between">
        <RiskGauge tier={previewTier} fraction={gaugeFraction} />
        <div className="sm:max-w-sm">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Live computed risk tier</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{pushExplanation}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="rounded-xl border border-[var(--accent)]/40 bg-[var(--surface)] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
            Human oversight &amp; customer impact - these two change the tier
          </h2>

          <p className="mt-3 text-sm font-medium">How often does a human actually review this agent&apos;s output?</p>
          <div className="mt-2 flex gap-3">
            <IconOption
              label="Full review - every action"
              icon={<EyeFullIcon />}
              selected={humanOversightFrequency === "full-review"}
              onSelect={() => setHumanOversightFrequency("full-review")}
            />
            <IconOption
              label="Sampled - a percentage"
              icon={<EyeHalfIcon />}
              selected={humanOversightFrequency === "sampled"}
              onSelect={() => setHumanOversightFrequency("sampled")}
            />
            <IconOption
              label="Exception-only"
              icon={<EyeClosedIcon />}
              selected={humanOversightFrequency === "exception-only"}
              onSelect={() => setHumanOversightFrequency("exception-only")}
            />
          </div>
          {humanOversightFrequency === "sampled" && (
            <div className="mt-3">
              <label className="block text-xs font-medium">Sample percentage reviewed</label>
              <input
                type="number"
                min={1}
                max={99}
                value={humanReviewSamplePercent}
                onChange={(e) => setHumanReviewSamplePercent(e.target.value)}
                className="mt-1 w-32 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="e.g. 20"
              />
            </div>
          )}

          <p className="mt-5 text-sm font-medium">
            Does this agent directly make or influence a decision affecting a customer (credit, claims, pricing)?
          </p>
          <div className="mt-2 flex gap-3">
            <IconOption
              label="Yes - a real decision"
              icon={<ScaleIcon />}
              selected={customerImpactDecision}
              onSelect={() => setCustomerImpactDecision(true)}
            />
            <IconOption
              label="No - advisory / internal only"
              icon={<ShieldCheckIcon />}
              selected={!customerImpactDecision}
              onSelect={() => setCustomerImpactDecision(false)}
            />
          </div>
        </div>

        <div className="grid gap-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-sm font-semibold">Regulatory frameworks applicable</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {REGULATORY_FRAMEWORKS.map((fw) => (
                <label
                  key={fw}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium ${
                    regulatoryFrameworks.includes(fw)
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--background)] text-[var(--muted)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={regulatoryFrameworks.includes(fw)}
                    onChange={() => toggleInArray(regulatoryFrameworks, fw, setRegulatoryFrameworks)}
                  />
                  {fw}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">Data residency requirement</label>
            <input
              value={dataResidency}
              onChange={(e) => setDataResidency(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <p className="text-sm font-medium">Data sources</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DATA_SOURCES.map((ds) => (
                <label
                  key={ds.value}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium ${
                    dataSources.includes(ds.value)
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--background)] text-[var(--muted)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={dataSources.includes(ds.value)}
                    onChange={() => toggleInArray(dataSources, ds.value, setDataSources)}
                  />
                  {ds.label}
                </label>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">Specific sensitive data elements touched</label>
            <textarea
              value={sensitiveDataElements}
              onChange={(e) => setSensitiveDataElements(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="e.g. account numbers, health data, biometric identifiers"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Retention - inputs (days)</label>
            <input
              type="number"
              value={retentionInputsDays}
              onChange={(e) => setRetentionInputsDays(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Retention - outputs (days)</label>
            <input
              type="number"
              value={retentionOutputsDays}
              onChange={(e) => setRetentionOutputsDays(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Retention - logs (days)</label>
            <input
              type="number"
              value={retentionLogsDays}
              onChange={(e) => setRetentionLogsDays(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid gap-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Model sourcing</label>
            <select
              value={modelSourcing}
              onChange={(e) => setModelSourcing(e.target.value as ModelSourcing)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              <option value="third-party-api">Third-party API</option>
              <option value="in-house-fine-tuned">In-house / fine-tuned</option>
            </select>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Captured as real due-diligence documentation - not a risk multiplier. Calling a
              third-party LLM API is normal, not inherently risky.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium">Vendor / hosting</label>
            <input
              value={modelVendor}
              onChange={(e) => setModelVendor(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="e.g. Anthropic via the AI Gateway"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Expected usage volume</label>
            <input
              value={expectedUsageVolume}
              onChange={(e) => setExpectedUsageVolume(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="e.g. ~500 requests/week"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Business criticality / SLA</label>
            <input
              value={businessCriticality}
              onChange={(e) => setBusinessCriticality(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">Fallback / rollback plan</label>
            <textarea
              value={fallbackRollbackPlan}
              onChange={(e) => setFallbackRollbackPlan(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid gap-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:grid-cols-2">
          <h2 className="sm:col-span-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Accountability &amp; transparency
          </h2>
          <div>
            <label className="block text-sm font-medium">Named accountable escalation owner</label>
            <input
              value={escalationOwner}
              onChange={(e) => setEscalationOwner(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder={draft.owner}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Who is accountable if this agent causes harm</label>
            <input
              value={accountableOwner}
              onChange={(e) => setAccountableOwner(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder={draft.owner}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">Explainability requirement</label>
            <textarea
              value={explainabilityRequirement}
              onChange={(e) => setExplainabilityRequirement(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="How can a decision be explained, if asked?"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">Bias/fairness testing plan</label>
            <textarea
              value={biasFairnessTestingPlan}
              onChange={(e) => setBiasFairnessTestingPlan(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">Pre-production validation approach</label>
            <textarea
              value={preProductionValidation}
              onChange={(e) => setPreProductionValidation(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={usersToldAboutAi}
              onChange={(e) => setUsersToldAboutAi(e.target.checked)}
            />
            Affected users will be told they&apos;re interacting with / being decided on by an AI system
          </label>
        </div>

        <div className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:grid-cols-3">
          <h2 className="sm:col-span-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Security
          </h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={encryptedAtRestInTransit}
              onChange={(e) => setEncryptedAtRestInTransit(e.target.checked)}
            />
            Encrypted at rest and in transit
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={agentWriteAccessProduction}
              onChange={(e) => setAgentWriteAccessProduction(e.target.checked)}
            />
            Agent has write access to production systems
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={securityReviewCompleted}
              onChange={(e) => setSecurityReviewCompleted(e.target.checked)}
            />
            Security review completed before go-live
          </label>
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
          {submitting ? "Creating use case & calling recommendation engine..." : "Get recommendation"}
        </button>
      </form>
    </div>
  );
}
