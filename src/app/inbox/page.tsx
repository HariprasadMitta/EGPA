"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import type { ActionItem } from "@/app/api/action-inbox/route";

const TYPE_LABELS: Record<ActionItem["type"], string> = {
  arb_approval_needed: "ARB approval needed",
  recertification_overdue: "Recertification overdue",
  budget_alert: "Budget alert",
  own_gate_pending: "Your gate is pending",
};

const TYPE_TONE: Record<ActionItem["type"], string> = {
  arb_approval_needed: "border-[var(--tier-critical)]/30 bg-[var(--tier-critical-bg)] text-[var(--tier-critical)]",
  recertification_overdue: "border-[var(--tier-medium)]/30 bg-[var(--tier-medium-bg)] text-[var(--tier-medium)]",
  budget_alert: "border-[var(--tier-medium)]/30 bg-[var(--tier-medium-bg)] text-[var(--tier-medium)]",
  own_gate_pending: "border-[var(--status-current)]/30 bg-[var(--status-current-bg)] text-[var(--status-current)]",
};

const TYPE_HREF: Record<ActionItem["type"], string> = {
  arb_approval_needed: "/gate",
  recertification_overdue: "/gate",
  budget_alert: "/admin",
  own_gate_pending: "/gate",
};

export default function InboxPage() {
  const { user } = useAuth();
  const { setActiveId } = useStore();
  const router = useRouter();
  const [items, setItems] = useState<ActionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function goToItem(item: ActionItem) {
    if (item.useCaseId) setActiveId(item.useCaseId);
    router.push(TYPE_HREF[item.type]);
  }

  const userId = user?.id;
  useEffect(() => {
    // Depends on userId, not the user object - useAuth() returns a new
    // object literal every render, which would re-fire this effect (and
    // re-fetch) forever since the fetch's own setState triggers a re-render.
    if (!userId) return;
    fetch("/api/action-inbox")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Failed to load.");
        return body.items as ActionItem[];
      })
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [userId]);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--brand-strong)]">Sign in required</h1>
        <Link href="/login" className="mt-6 inline-block rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Your Action Inbox</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Everything real that&apos;s currently waiting on {user.name} — instead of having to remember to check
        every use case&apos;s own page. Oversight roles also see portfolio-wide items; every signed-in user
        sees their own use cases waiting on their next action.
      </p>

      {error && <p className="mt-6 text-sm text-[var(--tier-critical)]">{error}</p>}
      {!items && !error && <p className="mt-6 text-sm text-[var(--muted)]">Loading...</p>}

      {items && items.length === 0 && (
        <div className="mt-8 rounded-xl border border-[var(--tier-low)]/30 bg-[var(--tier-low-bg)] p-6 text-center text-sm text-[var(--tier-low)]">
          Nothing waiting on you right now.
        </div>
      )}

      {items && items.length > 0 && (
        <div className="mt-8 space-y-3">
          {items.map((item, i) => (
            <div key={i} className={`rounded-xl border p-4 ${TYPE_TONE[item.type]}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide">{TYPE_LABELS[item.type]}</span>
                <button type="button" onClick={() => goToItem(item)} className="text-xs font-semibold underline">
                  Go to it &rarr;
                </button>
              </div>
              <p className="mt-1 text-sm font-semibold">{item.useCaseTitle}</p>
              <p className="mt-0.5 text-xs opacity-90">{item.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
