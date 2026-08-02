"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

interface BudgetRow {
  id: string;
  useCaseId: string | null;
  businessDomain: string | null;
  monthlyLimitUsd: number;
  alertThresholdPct: number;
  status: { spentUsd: number; percentUsed: number; overThreshold: boolean } | null;
}

interface ApiKeyRow {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

function NotificationSection() {
  const [configured, setConfigured] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/notification-channel")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured);
        setEnabled(d.enabled);
        if (d.webhookUrl) setWebhookUrl(d.webhookUrl);
      });
  }
  useEffect(load, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/notification-channel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage("Saved - real Slack notifications are now live.");
      load();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle() {
    await fetch("/api/admin/notification-channel", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    load();
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Notifications &mdash; real Slack webhook
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Fires on: ARB approval needed, execution failed, kill-switch engaged, budget threshold crossed.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://hooks.slack.com/services/..."
          className="min-w-[260px] flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
        <button onClick={save} disabled={saving || !webhookUrl.trim()} className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? "Saving..." : "Save"}
        </button>
        {configured && (
          <button onClick={toggle} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium">
            {enabled ? "Disable" : "Enable"}
          </button>
        )}
      </div>
      {configured && <p className="mt-2 text-xs text-[var(--status-done)]">Configured &middot; {enabled ? "enabled" : "disabled"}</p>}
      {message && <p className="mt-2 text-xs text-[var(--muted)]">{message}</p>}
    </div>
  );
}

function BudgetsSection() {
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [scope, setScope] = useState<"useCase" | "businessDomain">("businessDomain");
  const [scopeValue, setScopeValue] = useState("");
  const [limit, setLimit] = useState("");

  function load() {
    fetch("/api/admin/budgets").then((r) => r.json()).then((d) => setBudgets(d.budgets ?? []));
  }
  useEffect(load, []);

  async function create() {
    if (!scopeValue.trim() || !limit) return;
    await fetch("/api/admin/budgets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        [scope === "useCase" ? "useCaseId" : "businessDomain"]: scopeValue.trim(),
        monthlyLimitUsd: Number(limit),
      }),
    });
    setScopeValue("");
    setLimit("");
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/budgets/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Budgets &amp; usage quotas
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Real monthly cost checked against real ExecutionRun.totalCostUsd - alerts via Slack at the threshold.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm">
          <option value="businessDomain">Business domain</option>
          <option value="useCase">Use case ID</option>
        </select>
        <input value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} placeholder={scope === "useCase" ? "uc-..." : "e.g. Retail Banking - Customer Care"} className="min-w-[200px] flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
        <input value={limit} onChange={(e) => setLimit(e.target.value)} type="number" placeholder="Monthly limit USD" className="w-36 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
        <button onClick={create} className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">Add</button>
      </div>
      <div className="mt-4 space-y-2">
        {budgets.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No budgets set.</p>
        ) : (
          budgets.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <span>
                <span className="font-semibold">{b.useCaseId ?? b.businessDomain}</span> &mdash; ${b.status?.spentUsd.toFixed(4) ?? "0.0000"} / ${b.monthlyLimitUsd.toFixed(2)}{" "}
                {b.status?.overThreshold && <span className="text-[var(--tier-critical)]">(over {b.alertThresholdPct}% threshold)</span>}
              </span>
              <button onClick={() => remove(b.id)} className="text-xs text-[var(--muted)] hover:underline">Remove</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/api-keys").then((r) => r.json()).then((d) => setKeys(d.keys ?? []));
  }
  useEffect(load, []);

  async function create() {
    if (!name.trim()) return;
    const res = await fetch("/api/admin/api-keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewToken(data.token);
      setName("");
      load();
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/admin/api-keys/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Public API keys
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Real REST surface at <code className="font-mono">/api/public/use-cases</code> (GET list, POST create) -
        authenticate with <code className="font-mono">Authorization: Bearer &lt;key&gt;</code>.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. which external system)" className="min-w-[220px] flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
        <button onClick={create} disabled={!name.trim()} className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Generate</button>
      </div>
      {newToken && (
        <div className="mt-3 rounded-md border border-[var(--status-pending)]/40 bg-[var(--status-pending-bg)] p-3 text-xs">
          <p className="font-semibold text-[var(--tier-critical)]">Copy this now &mdash; won&apos;t be shown again.</p>
          <pre className="mt-1 overflow-x-auto rounded bg-[var(--background)] p-2 font-mono">{newToken}</pre>
        </div>
      )}
      <div className="mt-4 space-y-2">
        {keys.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No API keys yet.</p>
        ) : (
          keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <span>
                <span className="font-semibold">{k.name}</span>{" "}
                <span className="text-xs text-[var(--muted)]">
                  {k.revoked ? "revoked" : k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleString("en-US")}` : "never used"}
                </span>
              </span>
              {!k.revoked && <button onClick={() => revoke(k.id)} className="text-xs text-[var(--muted)] hover:underline">Revoke</button>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RetentionSection() {
  const [result, setResult] = useState<{ useCasesProcessed: number; totalRowsDeleted: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/retention-purge", { method: "POST" });
      const data = await res.json();
      if (res.ok) setResult(data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Data retention enforcement
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Real purge against each use case&apos;s declared retention periods (Intake&apos;s Risk &amp; Compliance
        Profile) - runs automatically daily via Vercel Cron, or trigger it manually here.
      </p>
      <button onClick={run} disabled={busy} className="mt-3 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Running..." : "Run retention purge now"}
      </button>
      {result && (
        <p className="mt-2 text-xs text-[var(--muted)]">
          Processed {result.useCasesProcessed} use case(s), {result.totalRowsDeleted} row(s) purged.
        </p>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();

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
    <div className="mx-auto max-w-4xl px-6 py-12 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Admin Console</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Real platform configuration &mdash; notifications, budgets, public API access, and data retention.
        </p>
      </div>
      <NotificationSection />
      <BudgetsSection />
      <ApiKeysSection />
      <RetentionSection />
    </div>
  );
}
