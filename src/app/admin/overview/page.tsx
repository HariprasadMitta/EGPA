"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { StatTile, HorizontalBarChart, riskTierColor } from "@/components/charts";

interface OverviewData {
  totalUseCases: number;
  killSwitchEngagedCount: number;
  useCasesByStatus: { label: string; value: number }[];
  useCasesByRiskTier: { label: string; value: number }[];
  usersByRole: { label: string; value: number }[];
  totalUsers: number;
  totalExecutions: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  recentActivity: {
    id: string;
    action: string;
    detail: string | null;
    actorName: string;
    useCaseId: string;
    useCaseTitle: string;
    createdAt: string;
  }[];
}

interface PostureData {
  criticalArbApproval: { total: number; approved: number };
  recertificationOverdue: number;
  piiRedactionsThisMonth: number;
  anomaliesThisMonth: number;
  budgetAlertsActive: number;
}

const ACTION_LABELS: Record<string, string> = {
  kill_switch_engaged: "Kill-switch engaged",
  kill_switch_disengaged: "Kill-switch disengaged",
  control_acknowledged: "Control acknowledged",
  control_unacknowledged: "Control un-acknowledged",
  gate_finalized: "Governance gate cleared",
  arb_approved: "ARB approved",
  drift_detected: "Drift detected",
  anomaly_detected: "Anomaly detected",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { setActiveId } = useStore();
  const [data, setData] = useState<OverviewData | null>(null);
  const [posture, setPosture] = useState<PostureData | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openUseCase(id: string) {
    setActiveId(id);
    router.push("/gate");
  }

  const role = user?.role;
  useEffect(() => {
    if (role !== "admin") return;
    Promise.all([
      fetch("/api/admin/overview").then((r) => r.json()),
      fetch("/api/governance-posture").then((r) => r.json()),
    ])
      .then(([overview, postureData]) => {
        if (overview.error) throw new Error(overview.error);
        setData(overview);
        setPosture(postureData.error ? null : postureData);
      })
      .catch((err) => setError((err as Error).message));
  }, [role]);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--brand-strong)]">Sign in required</h1>
        <Link href="/login" className="mt-6 inline-block rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white">Sign in</Link>
      </div>
    );
  }
  if (user.role !== "admin") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--brand-strong)]">Admin access required</h1>
        <p className="mt-2 text-[var(--muted)]">Signed in as {user.name} ({user.role}). Only Admin can see this page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Admin Overview</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            At-a-glance real numbers across the whole platform. For configuration &mdash;
            notifications, budgets, API keys, retention &mdash; see the{" "}
            <Link href="/admin" className="font-semibold text-[var(--accent)]">Admin Console</Link>.
          </p>
        </div>
      </div>

      {error && <p className="mt-6 text-sm text-[var(--tier-critical)]">{error}</p>}

      {!data ? (
        <p className="mt-8 text-sm text-[var(--muted)]">Loading real platform data&hellip;</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Use cases tracked" value={data.totalUseCases.toLocaleString("en-US")} />
            <StatTile label="Real executions" value={data.totalExecutions.toLocaleString("en-US")} />
            <StatTile label="Total real spend" value={`$${data.totalCostUsd.toFixed(2)}`} />
            <StatTile label="Users in org" value={data.totalUsers.toLocaleString("en-US")} />
            <StatTile
              label="Kill-switch engaged"
              value={data.killSwitchEngagedCount.toString()}
              tone={data.killSwitchEngagedCount > 0 ? "critical" : "good"}
            />
            <StatTile
              label="Critical ARB approval"
              value={posture ? `${posture.criticalArbApproval.approved}/${posture.criticalArbApproval.total}` : "..."}
              tone={posture && posture.criticalArbApproval.approved < posture.criticalArbApproval.total ? "warning" : "good"}
            />
            <StatTile
              label="Recert overdue"
              value={posture ? posture.recertificationOverdue.toString() : "..."}
              tone={posture && posture.recertificationOverdue > 0 ? "warning" : "good"}
            />
            <StatTile
              label="Budget alerts active"
              value={posture ? posture.budgetAlertsActive.toString() : "..."}
              tone={posture && posture.budgetAlertsActive > 0 ? "critical" : "good"}
            />
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                Use cases by status
              </h2>
              <div className="mt-4">
                <HorizontalBarChart data={data.useCasesByStatus} />
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                Use cases by risk tier
              </h2>
              <div className="mt-4">
                <HorizontalBarChart data={data.useCasesByRiskTier} colorFor={(label) => riskTierColor(label)} />
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                Users by role
              </h2>
              <div className="mt-4">
                <HorizontalBarChart data={data.usersByRole} />
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                Token usage (all-time real total)
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <StatTile label="Input tokens" value={data.totalInputTokens.toLocaleString("en-US")} />
                <StatTile label="Output tokens" value={data.totalOutputTokens.toLocaleString("en-US")} />
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Per-person breakdown is on the{" "}
                <Link href="/admin" className="font-semibold text-[var(--accent)]">Admin Console&apos;s per-user consumption table</Link>.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Recent activity &mdash; real governance actions, across every use case
            </h2>
            {data.recentActivity.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">No governance actions recorded yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {data.recentActivity.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[var(--border)] pb-2 text-sm last:border-0">
                    <span>
                      <span className="font-semibold">{ACTION_LABELS[a.action] ?? a.action}</span>{" "}
                      <span className="text-[var(--muted)]">by {a.actorName} on</span>{" "}
                      <button
                        onClick={() => openUseCase(a.useCaseId)}
                        className="font-medium text-[var(--accent)] hover:underline"
                      >
                        {a.useCaseTitle}
                      </button>
                      {a.detail && <span className="text-[var(--muted)]"> &mdash; {a.detail}</span>}
                    </span>
                    <span className="flex-none text-xs text-[var(--muted)]">{timeAgo(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
