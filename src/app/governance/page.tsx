"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { canSeeAllUseCases } from "@/lib/roles";
import { StatTile, HorizontalBarChart } from "@/components/charts";
import { formatHours } from "@/lib/timeSaved";

interface PostureData {
  criticalArbApproval: { total: number; approved: number };
  recertificationOverdue: number;
  piiRedactionsThisMonth: number;
  anomaliesThisMonth: number;
  budgetAlertsActive: number;
  totalUseCasesTracked: number;
}

interface GivenDelegation {
  id: string;
  delegateName: string;
  delegateEmail: string;
  scope: string;
  startsAt: string;
  endsAt: string;
  revoked: boolean;
}

interface ReceivedDelegation {
  id: string;
  delegatorName: string;
  delegatorEmail: string;
  scope: string;
  startsAt: string;
  endsAt: string;
  revoked: boolean;
}

const SCOPE_LABELS: Record<string, string> = {
  arb_approval: "ARB approval",
  governance_owner_actions: "Governance-owner actions (kill switch, attestation)",
};

function DelegationsSection({ role }: { role: string }) {
  const [given, setGiven] = useState<GivenDelegation[]>([]);
  const [received, setReceived] = useState<ReceivedDelegation[]>([]);
  const [delegateEmail, setDelegateEmail] = useState("");
  const [scope, setScope] = useState(role === "arb" ? "arb_approval" : "governance_owner_actions");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    fetch("/api/delegations")
      .then((r) => r.json())
      .then((d) => {
        setGiven(d.given ?? []);
        setReceived(d.received ?? []);
      });
  }
  useEffect(load, []);

  async function create() {
    setError(null);
    if (!delegateEmail.trim() || !startsAt || !endsAt) {
      setError("Fill in the delegate's email and both dates.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/delegations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          delegateEmail: delegateEmail.trim(),
          scope,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create delegation.");
        return;
      }
      setDelegateEmail("");
      setStartsAt("");
      setEndsAt("");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/delegations/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Approval delegation
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Hand off your own ARB or governance-owner authority to someone else for a real time window - the
        audited replacement for sharing a login while you&apos;re out.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <input
          value={delegateEmail}
          onChange={(e) => setDelegateEmail(e.target.value)}
          placeholder="Delegate's email"
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        >
          {role !== "governance-owner" && <option value="arb_approval">ARB approval</option>}
          {role !== "arb" && <option value="governance_owner_actions">Governance-owner actions</option>}
        </select>
        <label className="text-xs">
          Starts
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
        </label>
        <label className="text-xs">
          Ends
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
        </label>
      </div>
      <button onClick={create} disabled={busy} className="mt-3 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Creating..." : "Create delegation"}
      </button>
      {error && <p className="mt-2 text-xs text-[var(--tier-critical)]">{error}</p>}

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Delegations you&apos;ve given</p>
        <div className="mt-2 space-y-2">
          {given.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">None yet.</p>
          ) : (
            given.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                <span className="text-xs">
                  <strong>{d.delegateName}</strong> ({d.delegateEmail}) &middot; {SCOPE_LABELS[d.scope] ?? d.scope} &middot;{" "}
                  {new Date(d.startsAt).toLocaleString("en-US")} &rarr; {new Date(d.endsAt).toLocaleString("en-US")}
                  {d.revoked && " · revoked"}
                </span>
                {!d.revoked && <button onClick={() => revoke(d.id)} className="text-xs text-[var(--muted)] hover:underline">Revoke</button>}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Delegations you&apos;ve received</p>
        <div className="mt-2 space-y-2">
          {received.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">None yet.</p>
          ) : (
            received.map((d) => (
              <div key={d.id} className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs">
                From <strong>{d.delegatorName}</strong> ({d.delegatorEmail}) &middot; {SCOPE_LABELS[d.scope] ?? d.scope} &middot;{" "}
                {new Date(d.startsAt).toLocaleString("en-US")} &rarr; {new Date(d.endsAt).toLocaleString("en-US")}
                {d.revoked && " · revoked"}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface BusinessValueData {
  timeSaved: { totalHoursSaved: number; useCasesCounted: number };
  costSaved: { totalCostSavedUsd: number; useCasesCounted: number };
  modelAdoption: { entries: { provider: string; useCaseCount: number }[]; reusedModelCount: number };
  complianceExposureCaught: {
    piiDetections: number;
    undeclaredToolIncidents: number;
    preflightDenials: number;
    killSwitchEngagements: number;
    total: number;
  };
  cycleTimeToProduction: { averageHours: number | null; useCasesCounted: number };
  totalUseCasesTracked: number;
}

function BusinessValueSection() {
  const [data, setData] = useState<BusinessValueData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/business-value")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Failed to load.");
        return body as BusinessValueData;
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Business value</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Real, computed evidence of what governing through this platform is worth &mdash; not projections.
        Time and cost saved compare against an honest, admin-declared baseline (see Admin &rarr; Governance
        baseline); everything else is counted directly from the audit trail.
      </p>

      {error && <p className="mt-4 text-sm text-[var(--tier-critical)]">{error}</p>}
      {!data && !error && <p className="mt-4 text-sm text-[var(--muted)]">Loading real business-value data...</p>}

      {data && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Approval time saved"
              value={data.timeSaved.useCasesCounted > 0 ? formatHours(data.timeSaved.totalHoursSaved) : "-"}
              sub={`across ${data.timeSaved.useCasesCounted} use case(s) with a set baseline`}
            />
            <StatTile
              label="Delivery cost saved"
              value={data.costSaved.useCasesCounted > 0 ? `$${data.costSaved.totalCostSavedUsd.toFixed(2)}` : "-"}
              sub={`across ${data.costSaved.useCasesCounted} use case(s) with a declared cost/hour`}
            />
            <StatTile
              label="Cycle time to production"
              value={data.cycleTimeToProduction.averageHours != null ? formatHours(data.cycleTimeToProduction.averageHours) : "-"}
              sub={`avg. Intake -> first completed execution, ${data.cycleTimeToProduction.useCasesCounted} use case(s)`}
            />
            <StatTile
              label="Models reused across use cases"
              value={String(data.modelAdoption.reusedModelCount)}
              sub={`of ${data.modelAdoption.entries.length} distinct model(s) actually used`}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Compliance exposure caught (total: {data.complianceExposureCaught.total})
              </h3>
              <div className="mt-3">
                <HorizontalBarChart
                  data={[
                    { label: "PII detections", value: data.complianceExposureCaught.piiDetections },
                    { label: "Undeclared-tool incidents", value: data.complianceExposureCaught.undeclaredToolIncidents },
                    { label: "Preflight denials", value: data.complianceExposureCaught.preflightDenials },
                    { label: "Kill-switch engagements", value: data.complianceExposureCaught.killSwitchEngagements },
                  ]}
                />
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Model Registry adoption (distinct use cases per model actually used)
              </h3>
              <div className="mt-3">
                <HorizontalBarChart
                  data={data.modelAdoption.entries.map((e) => ({ label: e.provider, value: e.useCaseCount }))}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: "good" | "warning" | "critical" | "neutral";
  detail: string;
}) {
  const toneClasses: Record<string, string> = {
    good: "border-[var(--tier-low)]/30 bg-[var(--tier-low-bg)] text-[var(--tier-low)]",
    warning: "border-[var(--tier-medium)]/30 bg-[var(--tier-medium-bg)] text-[var(--tier-medium)]",
    critical: "border-[var(--tier-critical)]/30 bg-[var(--tier-critical-bg)] text-[var(--tier-critical)]",
    neutral: "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",
  };
  return (
    <div className={`rounded-xl border p-5 ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs opacity-80">{detail}</p>
    </div>
  );
}

export default function GovernancePosturePage() {
  const { user } = useAuth();
  const [data, setData] = useState<PostureData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !canSeeAllUseCases(user.role)) return;
    fetch("/api/governance-posture")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Failed to load.");
        return body as PostureData;
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--brand-strong)]">Sign in required</h1>
        <Link href="/login" className="mt-6 inline-block rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white">Sign in</Link>
      </div>
    );
  }
  if (!canSeeAllUseCases(user.role)) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--brand-strong)]">Governance-owner, ARB, or admin access required</h1>
        <p className="mt-2 text-[var(--muted)]">Signed in as {user.name} ({user.role}). Only portfolio-wide oversight roles can see this page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Governance Posture</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        A real, org-wide rollup of whether the portfolio is actually adhering to the governance this platform
        computed and required — not a per-use-case view, the aggregate a compliance owner actually needs.
      </p>

      {error && <p className="mt-6 text-sm text-[var(--tier-critical)]">{error}</p>}

      {!data && !error && <p className="mt-6 text-sm text-[var(--muted)]">Loading real posture data...</p>}

      {data && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Critical-tier ARB approval"
            value={`${data.criticalArbApproval.approved} / ${data.criticalArbApproval.total}`}
            tone={
              data.criticalArbApproval.total === 0
                ? "neutral"
                : data.criticalArbApproval.approved === data.criticalArbApproval.total
                  ? "good"
                  : "critical"
            }
            detail="Critical-tier use cases with a current ARB sign-off, out of every Critical-tier use case tracked."
          />
          <StatCard
            label="Recertification overdue"
            value={String(data.recertificationOverdue)}
            tone={data.recertificationOverdue === 0 ? "good" : "warning"}
            detail="Use cases past their governance template's recertification interval since last acknowledgment."
          />
          <StatCard
            label="Budget alerts active"
            value={String(data.budgetAlertsActive)}
            tone={data.budgetAlertsActive === 0 ? "good" : "warning"}
            detail="Budgets currently at or above their alert threshold this calendar month."
          />
          <StatCard
            label="PII redactions this month"
            value={String(data.piiRedactionsThisMonth)}
            tone="neutral"
            detail="Sub-agent steps this month where real PII was detected and redacted from output."
          />
          <StatCard
            label="Anomalies this month"
            value={String(data.anomaliesThisMonth)}
            tone={data.anomaliesThisMonth === 0 ? "good" : "warning"}
            detail="Drift and execution-volume anomalies detected and logged this calendar month."
          />
          <StatCard
            label="Use cases tracked"
            value={String(data.totalUseCasesTracked)}
            tone="neutral"
            detail="Total use cases with a governance gate record in the portfolio."
          />
        </div>
      )}

      <p className="mt-8 text-xs text-[var(--muted)]">
        Every number above is computed live from the same audit log, governance gate, budget, and execution
        records the per-use-case pages already show — this page only aggregates, it doesn&apos;t introduce a
        second source of truth.
      </p>

      <BusinessValueSection />

      <DelegationsSection role={user.role} />
    </div>
  );
}
