"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { canApproveArb, canToggleKillSwitch } from "@/lib/roles";
import { useStore } from "@/lib/store";
import { RiskBadge } from "@/components/RiskBadge";

const HITL_DESCRIPTIONS: Record<string, string> = {
  none: "No human-in-the-loop step required.",
  advisory: "A human is shown the agent's action but approval is not blocking.",
  "approval-required": "A named approver must sign off before the agent proceeds.",
  manual: "Every action requires manual human execution or confirmation.",
};

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
        <RiskBadge tier={useCase.riskTier} />
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

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleProceed}
          disabled={!allAcknowledged}
          className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:bg-[var(--border)] disabled:text-[var(--muted)] disabled:shadow-none"
        >
          Proceed to ADR &rarr;
        </button>
      </div>
    </div>
  );
}
