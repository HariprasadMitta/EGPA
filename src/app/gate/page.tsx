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
import { AuditLogEntry, Comment } from "@/types";

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
};

function RecertificationBanner({ riskTier, acknowledgedAt }: { riskTier: string; acknowledgedAt: string | null }) {
  const days = GOVERNANCE_TEMPLATES[riskTier as keyof typeof GOVERNANCE_TEMPLATES]?.recertificationDays;
  // "Now" is real wall-clock time, not derivable during render (impure) -
  // computed once on mount, same class of client-only value as every other
  // post-mount hydration read in this app (see store.tsx's activeId).
  const [now, setNow] = useState<number | null>(null);
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
    </div>
  );
}

function GovernanceHistoryPanel({ useCaseId }: { useCaseId: string }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    fetch(`/api/use-cases/${useCaseId}/audit-log`)
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries ?? []);
        setLoaded(true);
      });
  }, [open, loaded, useCaseId]);

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
      )}
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

  const { useCase, gate } = active;
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
        <div className="mt-6 rounded-md border border-[var(--tier-low)]/30 bg-[var(--tier-low-bg)] px-4 py-3 text-sm text-[var(--tier-low)]">
          All required controls acknowledged. This use case has cleared its
          governance gate.
        </div>
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

      <RecertificationBanner riskTier={useCase.riskTier} acknowledgedAt={gate.acknowledgedAt} />

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleProceed}
          disabled={!allAcknowledged}
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
