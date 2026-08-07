"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { canApproveArb, canToggleKillSwitch } from "@/lib/roles";
import { useStore } from "@/lib/store";
import { RiskBadge } from "@/components/RiskBadge";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { GOVERNANCE_TEMPLATES } from "@/lib/governance";
import {
  AuditLogEntry,
  AutonomyLevel,
  Comment,
  DataSensitivity,
  HumanOversightFrequency,
  IntegrationSurface,
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
  { value: "external-financial-or-safety", label: "External, financial or safety-critical" },
];

const OVERSIGHT_OPTIONS: { value: HumanOversightFrequency; label: string }[] = [
  { value: "full-review", label: "Full review - every action" },
  { value: "sampled", label: "Sampled - a percentage" },
  { value: "exception-only", label: "Exception-only" },
];

function MaterialChangePanel({
  useCaseId,
  dataSensitivity,
  autonomyLevel,
  integrationSurface,
  humanOversightFrequency,
  customerImpactDecision,
}: {
  useCaseId: string;
  dataSensitivity: DataSensitivity;
  autonomyLevel: AutonomyLevel;
  integrationSurface: IntegrationSurface;
  humanOversightFrequency: HumanOversightFrequency | null;
  customerImpactDecision: boolean | null;
}) {
  const [open, setOpen] = useState(false);
  const [nextDataSensitivity, setNextDataSensitivity] = useState(dataSensitivity);
  const [nextAutonomyLevel, setNextAutonomyLevel] = useState(autonomyLevel);
  const [nextIntegrationSurface, setNextIntegrationSurface] = useState(integrationSurface);
  const [nextOversight, setNextOversight] = useState(humanOversightFrequency ?? "full-review");
  const [nextCustomerImpact, setNextCustomerImpact] = useState(customerImpactDecision ?? false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/use-cases/${useCaseId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dataSensitivity: nextDataSensitivity,
          autonomyLevel: nextAutonomyLevel,
          integrationSurface: nextIntegrationSurface,
          humanOversightFrequency: nextOversight,
          customerImpactDecision: nextCustomerImpact,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save.");
        return;
      }
      setResult(`Saved - recomputed risk tier: ${data.newRiskTier}. Sent back through the governance gate for re-approval.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Amend risk-relevant inputs &mdash; forces re-approval on any real change
        </p>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-4 w-4 flex-none transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-xs text-[var(--muted)]">
            Approval today doesn&apos;t hold forever - changing any of these fields recomputes the risk tier and
            unconditionally resets this use case&apos;s governance gate (and ARB sign-off, if required) back to
            pending, even if the tier number doesn&apos;t change.
          </p>
          <label className="block">
            <span className="text-xs font-medium">Data sensitivity</span>
            <select
              value={nextDataSensitivity}
              onChange={(e) => setNextDataSensitivity(e.target.value as DataSensitivity)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              {DATA_SENSITIVITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium">Agent autonomy level</span>
            <select
              value={nextAutonomyLevel}
              onChange={(e) => setNextAutonomyLevel(e.target.value as AutonomyLevel)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              {AUTONOMY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium">Integration surface</span>
            <select
              value={nextIntegrationSurface}
              onChange={(e) => setNextIntegrationSurface(e.target.value as IntegrationSurface)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              {INTEGRATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium">Human oversight frequency</span>
            <select
              value={nextOversight}
              onChange={(e) => setNextOversight(e.target.value as HumanOversightFrequency)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              {OVERSIGHT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={nextCustomerImpact}
              onChange={(e) => setNextCustomerImpact(e.target.checked)}
            />
            <span className="text-xs font-medium">Directly makes/influences a customer decision</span>
          </label>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-[var(--brand)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-strong)] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save & send back for re-approval"}
          </button>
          {result && <p className="text-xs text-[var(--tier-medium)]">{result}</p>}
          {error && <p className="text-xs text-[var(--tier-critical)]">{error}</p>}
        </div>
      )}
    </div>
  );
}

const HITL_DESCRIPTIONS: Record<string, string> = {
  none: "No human-in-the-loop step required.",
  advisory: "A human is shown the agent's action but approval is not blocking.",
  "approval-required": "A named approver must sign off before the agent proceeds.",
  manual: "Every action requires manual human execution or confirmation.",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  kill_switch_engaged: "engaged the kill switch",
  kill_switch_disengaged: "disengaged the kill switch",
  control_acknowledged: "acknowledged a control",
  control_unacknowledged: "un-acknowledged a control",
  gate_finalized: "finalized the governance gate",
  arb_approved: "approved as ARB",
  drift_detected: "real drift detected (system)",
  anomaly_detected: "real anomaly detected (system)",
  comment_added: "added a comment",
  recertification_attested: "attested recertification",
  arb_approval_needed: "flagged ARB approval as needed (system)",
  stale_approval_escalated: "escalated a stale ARB approval (system)",
  material_change_reapproval: "amended risk-relevant inputs, sent back for re-approval",
  undeclared_tool_detected: "reported undeclared tool usage",
  preflight_check_denied: "denied a real-time preflight check",
  use_case_rejected: "rejected this use case",
  use_case_resubmitted: "resubmitted this use case",
};

function RecertificationBanner({
  useCaseId,
  riskTier,
  acknowledgedAt,
}: {
  useCaseId: string;
  riskTier: string;
  acknowledgedAt: string | null;
}) {
  const { attestRecertification } = useStore();
  const { user } = useAuth();
  const days = GOVERNANCE_TEMPLATES[riskTier as keyof typeof GOVERNANCE_TEMPLATES]?.recertificationDays;
  // "Now" is real wall-clock time, not derivable during render (impure) -
  // computed once on mount, same class of client-only value as every other
  // post-mount hydration read in this app (see store.tsx's activeId).
  const [now, setNow] = useState<number | null>(null);
  const [attesting, setAttesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, []);

  if (!acknowledgedAt || !days || now === null) return null;

  const dueDate = new Date(new Date(acknowledgedAt).getTime() + days * 24 * 60 * 60 * 1000);
  const daysLeft = Math.ceil((dueDate.getTime() - now) / (24 * 60 * 60 * 1000));
  const overdue = daysLeft < 0;
  const dueSoon = daysLeft >= 0 && daysLeft <= 14;

  if (!overdue && !dueSoon) return null;

  async function handleAttest() {
    setAttesting(true);
    setError(null);
    const err = await attestRecertification(useCaseId);
    if (err) setError(err);
    setAttesting(false);
  }

  const canAttest = user && canToggleKillSwitch(user.role);

  return (
    <div
      className={`mt-6 rounded-md border px-4 py-3 text-sm ${
        overdue
          ? "border-[var(--tier-critical)]/30 bg-[var(--tier-critical-bg)] text-[var(--tier-critical)]"
          : "border-[var(--tier-medium)]/30 bg-[var(--tier-medium-bg)] text-[var(--tier-medium)]"
      }`}
    >
      <span className="font-semibold">
        {overdue ? "Recertification overdue" : "Recertification due soon"}
      </span>{" "}
      &mdash; this {riskTier}-tier use case&apos;s governance sign-off was acknowledged on{" "}
      {new Date(acknowledgedAt).toLocaleDateString("en-US")} and is real-cycled every {days} days. Due{" "}
      {overdue ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago` : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
      {" "}({dueDate.toLocaleDateString("en-US")}).
      {canAttest && (
        <div className="mt-2">
          <button
            type="button"
            onClick={handleAttest}
            disabled={attesting}
            className="rounded-full border border-current px-3 py-1 text-xs font-semibold transition-colors hover:opacity-80 disabled:opacity-60"
          >
            {attesting ? "Attesting..." : "I confirm this still matches production"}
          </button>
          {error && <span className="ml-2 text-xs">{error}</span>}
        </div>
      )}
    </div>
  );
}

interface ReconciledReport {
  id: string;
  source: string;
  toolsUsed: string[];
  modelUsed: string | null;
  reportedAt: string;
  undeclaredTools: string[];
}

interface ReconciliationView {
  declaredTools: string[];
  declaredModelVendor: string | null;
  internalExecutionCount: number;
  externalReports: ReconciledReport[];
  totalUndeclaredToolIncidents: number;
}

function ReconciliationPanel({ useCaseId }: { useCaseId: string }) {
  const [view, setView] = useState<ReconciliationView | null>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    fetch(`/api/use-cases/${useCaseId}/reconciliation`)
      .then((r) => r.json())
      .then((d) => {
        setView(d);
        setLoaded(true);
      });
  }, [open, loaded, useCaseId]);

  return (
    <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Declared vs. actual &mdash; real reconciliation, not a checkbox
        </p>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-4 w-4 flex-none transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && view && (
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Declared tool stack</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {view.declaredTools.length === 0 ? (
                <span className="text-xs text-[var(--muted)]">None declared yet.</span>
              ) : (
                view.declaredTools.map((t) => (
                  <span key={t} className="rounded-full border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs">{t}</span>
                ))
              )}
            </div>
            {view.declaredModelVendor && (
              <p className="mt-2 text-xs text-[var(--muted)]">Declared model vendor: <strong>{view.declaredModelVendor}</strong></p>
            )}
          </div>

          <div className="rounded-md border border-[var(--tier-low)]/30 bg-[var(--tier-low-bg)] px-3 py-2 text-xs text-[var(--tier-low)]">
            <strong>{view.internalExecutionCount} real execution(s)</strong> run through this platform&apos;s own
            engine - preventively guaranteed to match the declared tool stack (a step outside it is rejected before
            it can run at all, not just checked afterward).
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              External production system reports ({view.externalReports.length})
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              For an agent your own team runs outside this platform - reported via the public API, reconciled
              against the declared stack above.
            </p>
            {view.externalReports.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--muted)]">No external reports yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {view.externalReports.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-md border px-3 py-2 text-xs ${
                      r.undeclaredTools.length > 0
                        ? "border-[var(--tier-critical)]/30 bg-[var(--tier-critical-bg)] text-[var(--tier-critical)]"
                        : "border-[var(--border)] bg-[var(--background)]"
                    }`}
                  >
                    <span suppressHydrationWarning>{new Date(r.reportedAt).toLocaleString("en-US")}</span>
                    {" - "}tools used: {r.toolsUsed.join(", ") || "none reported"}
                    {r.modelUsed && ` - model: ${r.modelUsed}`}
                    {r.undeclaredTools.length > 0 && (
                      <p className="mt-1 font-semibold">
                        VIOLATION: undeclared tool(s) used - {r.undeclaredTools.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface AuditVerifyResult {
  totalEntries: number;
  verifiedEntries: number;
  legacyEntries: number;
  tamperedEntryIds: string[];
  chainIntact: boolean;
}

function GovernanceHistoryPanel({ useCaseId }: { useCaseId: string }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [verifyResult, setVerifyResult] = useState<AuditVerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    fetch(`/api/use-cases/${useCaseId}/audit-log`)
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries ?? []);
        setLoaded(true);
      });
  }, [open, loaded, useCaseId]);

  async function handleVerify() {
    setVerifying(true);
    try {
      const res = await fetch(`/api/use-cases/${useCaseId}/audit-log/verify`);
      const data = await res.json();
      if (res.ok) setVerifyResult(data);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Governance action history &mdash; real, who did what and when
        </p>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-4 w-4 flex-none transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {entries.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No governance actions logged yet.</p>
            ) : (
              entries.map((e) => (
                <div key={e.id} className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs">
                  <span className="font-semibold">{e.actorName}</span>{" "}
                  {AUDIT_ACTION_LABELS[e.action] ?? e.action}
                  {e.detail && <span className="text-[var(--muted)]"> &mdash; {e.detail}</span>}
                  <span className="ml-2 text-[var(--muted)]" suppressHydrationWarning>
                    {new Date(e.createdAt).toLocaleString("en-US")}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying}
              className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--background)] disabled:opacity-60"
            >
              {verifying ? "Verifying..." : "Verify tamper-evident hash chain"}
            </button>
            {verifyResult && (
              <p className={`mt-2 text-xs ${verifyResult.chainIntact ? "text-[var(--tier-low)]" : "text-[var(--tier-critical)]"}`}>
                {verifyResult.chainIntact
                  ? `Chain intact - ${verifyResult.verifiedEntries} of ${verifyResult.totalEntries} entries cryptographically verified`
                  : `TAMPERING DETECTED - ${verifyResult.tamperedEntryIds.length} entr${verifyResult.tamperedEntryIds.length === 1 ? "y" : "ies"} failed verification`}
                {verifyResult.legacyEntries > 0 && ` (${verifyResult.legacyEntries} legacy entr${verifyResult.legacyEntries === 1 ? "y" : "ies"} predate this feature, not verifiable).`}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RejectPanel({ useCaseId, canReject }: { useCaseId: string; canReject: boolean }) {
  const { rejectUseCase } = useStore();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canReject) return null;

  async function handleReject() {
    if (!reason.trim()) {
      setError("Enter a reason for rejecting this use case.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const err = await rejectUseCase(useCaseId, reason.trim());
    setSubmitting(false);
    if (err) setError(err);
  }

  return (
    <div className="mt-6 rounded-xl border border-[var(--tier-critical)]/30 bg-[var(--surface)] p-6">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--tier-critical)]">
          Reject this use case
        </p>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-4 w-4 flex-none transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-[var(--muted)]">
            Blocks this use case from proceeding and sends it back to the owner, who can amend and resubmit it.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection - shown to the owner and recorded in the audit trail"
            rows={3}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleReject}
            disabled={submitting}
            className="rounded-full bg-[var(--tier-critical)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Rejecting..." : "Reject use case"}
          </button>
          {error && <p className="text-xs text-[var(--tier-critical)]">{error}</p>}
        </div>
      )}
    </div>
  );
}

function ResubmitBanner({ useCaseId, canResubmit }: { useCaseId: string; canResubmit: boolean }) {
  const { resubmitUseCase } = useStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResubmit() {
    setSubmitting(true);
    setError(null);
    const err = await resubmitUseCase(useCaseId);
    setSubmitting(false);
    if (err) setError(err);
  }

  return (
    <div className="mt-6 rounded-xl border border-[var(--tier-critical)]/40 bg-[var(--tier-critical-bg)] p-6">
      <p className="text-sm font-semibold text-[var(--tier-critical)]">This use case was rejected.</p>
      <p className="mt-1 text-sm text-[var(--tier-critical)]">
        See the governance action history below for the reason. Amend the use case as needed, then resubmit to
        send it back through the recommendation and gate flow.
      </p>
      {canResubmit ? (
        <>
          <button
            type="button"
            onClick={handleResubmit}
            disabled={submitting}
            className="mt-3 rounded-full bg-[var(--brand)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-strong)] disabled:opacity-60"
          >
            {submitting ? "Resubmitting..." : "Resubmit for review"}
          </button>
          {error && <p className="mt-2 text-xs text-[var(--tier-critical)]">{error}</p>}
        </>
      ) : (
        <p className="mt-3 text-xs text-[var(--tier-critical)]">
          Only the use case owner or an Admin can resubmit it.
        </p>
      )}
    </div>
  );
}

interface TimeSavedData {
  available: boolean;
  actualHours?: number;
  baselineHours?: number;
  hoursSaved?: number;
  percentFaster?: number;
  costSavedUsd?: number | null;
}

function formatHoursLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  if (hours < 48) return `${hours.toFixed(1)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

function TimeSavedBanner({ useCaseId }: { useCaseId: string }) {
  const [data, setData] = useState<TimeSavedData | null>(null);

  useEffect(() => {
    fetch(`/api/use-cases/${useCaseId}/time-saved`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [useCaseId]);

  if (!data?.available || data.hoursSaved == null || data.percentFaster == null) return null;

  return (
    <div className="mt-4 rounded-md border border-[var(--accent)]/30 bg-[var(--tier-low-bg)] px-4 py-3 text-sm text-[var(--tier-low)]">
      <strong>Cleared governance in {formatHoursLabel(data.actualHours ?? 0)}</strong> - your
      organization&apos;s declared baseline for this risk tier is {formatHoursLabel(data.baselineHours ?? 0)},
      a real {Math.round(data.percentFaster)}% faster
      {data.costSavedUsd != null ? ` and an estimated $${data.costSavedUsd.toFixed(0)} saved` : ""}.
      <span className="mt-1 block text-xs text-[var(--muted)]">
        Baseline is a declared organizational assumption, not a measured fact - set by an admin.
      </span>
    </div>
  );
}

function CommentsThread({ useCaseId }: { useCaseId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  function load() {
    fetch(`/api/use-cases/${useCaseId}/comments`)
      .then((r) => r.json())
      .then((d) => setComments(d.comments ?? []));
  }

  useEffect(load, [useCaseId]);

  async function handlePost() {
    if (!text.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/use-cases/${useCaseId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text.trim() }),
      });
      if (res.ok) {
        setText("");
        load();
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Discussion &mdash; real comments on this use case
      </p>
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No comments yet.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{c.authorName}</span>
                <span className="text-xs text-[var(--muted)]" suppressHydrationWarning>
                  {new Date(c.createdAt).toLocaleString("en-US")}
                </span>
              </div>
              <p className="mt-1">{c.body}</p>
            </div>
          ))
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Leave a note for other reviewers..."
          className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          onKeyDown={(e) => e.key === "Enter" && handlePost()}
        />
        <button
          onClick={handlePost}
          disabled={posting || !text.trim()}
          className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Post
        </button>
      </div>
    </div>
  );
}

export default function GatePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { active, acknowledgeGateItem, finalizeGate, approveArb, toggleKillSwitch } = useStore();

  if (!active || !active.gate) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--brand-strong)]">
          No governance gate to show yet
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Get a recommendation first &mdash; the gate is generated from its
          computed risk tier.
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

  const { useCase, gate, riskComplianceDetails } = active;
  const controlsAcknowledged = gate.requiredControls.every((c) =>
    gate.acknowledgedItems.includes(c)
  );
  const arbClear = !gate.requiresArbApproval || gate.arbApproved;
  const allAcknowledged = controlsAcknowledged && arbClear;
  const isArb = user ? canApproveArb(user.role) : false;
  const canToggleKillSwitchRole = user ? canToggleKillSwitch(user.role) : false;

  function handleProceed() {
    finalizeGate(useCase.id);
    router.push("/adr");
  }

  function handleArbApprove() {
    if (!user) return;
    approveArb(useCase.id);
  }

  function handleToggleKillSwitch() {
    toggleKillSwitch(useCase.id, !useCase.killSwitchEngaged);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-strong)]">
            Governance Gate &amp; Sign-off
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{useCase.title}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <RiskBadge tier={useCase.riskTier} />
          <PresenceIndicator useCaseId={useCase.id} />
        </div>
      </div>

      <div
        className={`mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-5 ${
          useCase.killSwitchEngaged
            ? "border-[var(--tier-critical)]/40 bg-[var(--tier-critical-bg)]"
            : "border-[var(--border)] bg-[var(--surface)]"
        }`}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Kill switch &mdash; real, enforced at execution time
          </p>
          <p className="mt-1 text-sm">
            {useCase.killSwitchEngaged
              ? "Engaged - any execution attempt on this use case will be rejected by the server."
              : "Not engaged - execution is allowed (subject to the gate and controls below)."}
          </p>
        </div>
        {canToggleKillSwitchRole ? (
          <button
            onClick={handleToggleKillSwitch}
            className={`rounded-full px-5 py-2 text-sm font-semibold text-white transition-colors ${
              useCase.killSwitchEngaged
                ? "bg-[var(--status-done)] hover:opacity-90"
                : "bg-[var(--tier-critical)] hover:opacity-90"
            }`}
          >
            {useCase.killSwitchEngaged ? "Disengage" : "Engage kill switch"}
          </button>
        ) : (
          <span className="text-xs text-[var(--muted)]">
            Only a Governance Owner or Admin can toggle this.
          </span>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Human-in-the-loop tier
        </p>
        <p className="mt-1 text-lg font-bold text-[var(--brand-strong)]">
          {gate.hitlTier}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {HITL_DESCRIPTIONS[gate.hitlTier]}
        </p>
      </div>

      {gate.requiresArbApproval && (
        <div
          className={`mt-6 rounded-xl border p-6 ${
            gate.arbApproved
              ? "border-[var(--status-done)]/30 bg-[var(--status-done-bg)]"
              : "border-[var(--status-pending)]/40 bg-[var(--status-pending-bg)]"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Architecture Review Board sign-off &mdash; Critical tier only
            </p>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                gate.arbApproved
                  ? "bg-[var(--status-done)] text-white"
                  : "bg-[var(--status-pending)] text-white"
              }`}
            >
              {gate.arbApproved ? "Approved" : "Pending"}
            </span>
          </div>

          {gate.arbApproved ? (
            <p className="mt-2 text-sm text-[var(--status-done)]">
              Approved by <strong>{gate.arbApprovedBy}</strong>
              {gate.arbApprovedAt && (
                <> on {new Date(gate.arbApprovedAt).toLocaleString("en-US")}</>
              )}
              .
            </p>
          ) : isArb && user?.id === useCase.ownerUserId ? (
            <p className="mt-2 text-sm text-[var(--tier-medium)]">
              You submitted this use case, so you can&apos;t also clear its ARB sign-off &mdash;
              segregation of duties requires a different reviewer, even though your role could
              otherwise approve it.
            </p>
          ) : isArb ? (
            <>
              <p className="mt-2 text-sm">
                This Critical-tier use case requires a named reviewer from the
                Architecture Review Board before it can proceed &mdash; sign
                off manually below.
              </p>
              <button
                onClick={handleArbApprove}
                className="mt-4 rounded-full bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-strong)]"
              >
                Approve as {user?.name}
              </button>
            </>
          ) : (
            <p className="mt-2 text-sm text-[var(--muted)]">
              Waiting on manual sign-off from a Review Board (ARB) member.
              {user
                ? " Your role can't clear this item — only an ARB member or Admin can."
                : " Sign in as an ARB member or Admin to approve this."}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {`Required controls for ${useCase.riskTier} tier — blocking, not optional`}
        </p>
        <ul className="mt-4 list-none space-y-3">
          {gate.requiredControls.map((control) => {
            const checked = gate.acknowledgedItems.includes(control);
            return (
              <li key={control}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-sm transition-colors ${
                    checked
                      ? "border-[var(--tier-low)]/40 bg-[var(--tier-low-bg)]"
                      : "border-[var(--border)] bg-[var(--background)]"
                  } ${gate.acknowledged ? "cursor-default opacity-90" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={gate.acknowledged}
                    onChange={() => acknowledgeGateItem(useCase.id, control)}
                    className="h-4 w-4"
                  />
                  <span>{control}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      {gate.acknowledged ? (
        <>
          <div className="mt-6 rounded-md border border-[var(--tier-low)]/30 bg-[var(--tier-low-bg)] px-4 py-3 text-sm text-[var(--tier-low)]">
            All required controls acknowledged. This use case has cleared its
            governance gate.
          </div>
          <TimeSavedBanner useCaseId={useCase.id} />
        </>
      ) : (
        <p className="mt-4 text-xs text-[var(--muted)]">
          {gate.requiredControls.length - gate.acknowledgedItems.length} of{" "}
          {gate.requiredControls.length} controls still need acknowledgement
          {gate.requiresArbApproval && !gate.arbApproved
            ? ", and ARB sign-off is still pending, "
            : " "}
          before you can proceed.
        </p>
      )}

      {useCase.status === "rejected" ? (
        <ResubmitBanner
          useCaseId={useCase.id}
          canResubmit={Boolean(user) && (user?.id === useCase.ownerUserId || user?.role === "admin")}
        />
      ) : (
        <RejectPanel useCaseId={useCase.id} canReject={isArb || canToggleKillSwitchRole} />
      )}

      <RecertificationBanner useCaseId={useCase.id} riskTier={useCase.riskTier} acknowledgedAt={gate.acknowledgedAt} />

      <MaterialChangePanel
        useCaseId={useCase.id}
        dataSensitivity={useCase.dataSensitivity}
        autonomyLevel={useCase.autonomyLevel}
        integrationSurface={useCase.integrationSurface}
        humanOversightFrequency={riskComplianceDetails?.humanOversightFrequency ?? null}
        customerImpactDecision={riskComplianceDetails?.customerImpactDecision ?? null}
      />

      <ReconciliationPanel useCaseId={useCase.id} />

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleProceed}
          disabled={!allAcknowledged || useCase.status === "rejected"}
          className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:bg-[var(--border)] disabled:text-[var(--muted)] disabled:shadow-none"
        >
          Proceed to ADR &rarr;
        </button>
      </div>

      <GovernanceHistoryPanel useCaseId={useCase.id} />
      <CommentsThread useCaseId={useCase.id} />
    </div>
  );
}
