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
  scope: "read" | "read-write";
  expiresAt: string | null;
  expired: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

interface NotificationChannelRow {
  id: string;
  kind: "slack" | "teams" | "generic-webhook";
  enabled: boolean;
  webhookUrl: string | null;
  createdAt: string;
}

interface KnowledgeBaseDocumentRow {
  id: string;
  filename: string;
  sourceType: "pdf" | "docx" | "text";
  sizeBytes: number;
  chunkCount: number;
  uploadedByName: string;
  createdAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Real admin path onto the same Pinecone index knowledge_base_search reads
// from (src/lib/knowledgeBase.ts) - upload embeds and upserts real vectors
// via Cohere/Pinecone before this list ever shows the document, same
// pipeline scripts/ingest-knowledge-base.ts uses by hand.
function KnowledgeBaseSection() {
  const [documents, setDocuments] = useState<KnowledgeBaseDocumentRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/knowledge-base")
      .then((r) => r.json())
      .then((d) => setDocuments(d.documents ?? []));
  }
  useEffect(load, []);

  async function upload() {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/knowledge-base", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`Embedded and indexed ${data.document.chunkCount} real chunk${data.document.chunkCount === 1 ? "" : "s"} from "${data.document.filename}".`);
      setFile(null);
      load();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/knowledge-base?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Knowledge base &mdash; real governance documents
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Upload a .pdf, .docx, .txt, or .md file to embed it via Cohere and add it to the same Pinecone index
        knowledge_base_search reads from during every Agentic System run - real chunks, not a placeholder.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
        <button onClick={upload} disabled={uploading || !file} className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {uploading ? "Embedding..." : "Upload & embed"}
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-[var(--muted)]">{message}</p>}

      <div className="mt-4 space-y-2">
        {documents.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No documents uploaded yet.</p>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <span className="text-xs">
                <span className="font-semibold">{doc.filename}</span>{" "}
                <span className="text-[var(--muted)]">
                  &middot; {doc.chunkCount} chunk{doc.chunkCount === 1 ? "" : "s"} &middot; {formatFileSize(doc.sizeBytes)} &middot; {doc.uploadedByName}
                </span>
              </span>
              <button onClick={() => remove(doc.id)} className="text-xs text-[var(--muted)] hover:underline">
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const CHANNEL_KIND_LABELS: Record<NotificationChannelRow["kind"], string> = {
  slack: "Slack",
  teams: "Microsoft Teams",
  "generic-webhook": "Generic webhook (GRC/ITSM)",
};

function NotificationSection() {
  const [channels, setChannels] = useState<NotificationChannelRow[]>([]);
  const [kind, setKind] = useState<NotificationChannelRow["kind"]>("slack");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/notification-channel")
      .then((r) => r.json())
      .then((d) => setChannels(d.channels ?? []));
  }
  useEffect(load, []);

  async function add() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/notification-channel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, webhookUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`Saved - real ${CHANNEL_KIND_LABELS[kind]} notifications are now live.`);
      setWebhookUrl("");
      load();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: string, currentlyEnabled: boolean) {
    await fetch(`/api/admin/notification-channel/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !currentlyEnabled }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/notification-channel/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Notifications &mdash; real outbound webhooks
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Fires on: ARB approval needed, execution failed, kill-switch engaged, budget threshold crossed, stale
        approvals, material changes, undeclared tool usage. Every enabled channel below gets every event -
        Slack and Teams get a human-readable message, the generic webhook gets structured JSON for your own
        GRC/ITSM automation to route onward.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as NotificationChannelRow["kind"])}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        >
          <option value="slack">Slack</option>
          <option value="teams">Microsoft Teams</option>
          <option value="generic-webhook">Generic webhook (GRC/ITSM)</option>
        </select>
        <input
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://..."
          className="min-w-[260px] flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
        <button onClick={add} disabled={saving || !webhookUrl.trim()} className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? "Saving..." : "Add channel"}
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-[var(--muted)]">{message}</p>}

      <div className="mt-4 space-y-2">
        {channels.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No channels configured yet.</p>
        ) : (
          channels.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <span className="text-xs">
                <span className="font-semibold">{CHANNEL_KIND_LABELS[c.kind]}</span>{" "}
                <span className="text-[var(--muted)]">{c.enabled ? "enabled" : "disabled"}</span>
              </span>
              <span className="flex gap-2">
                <button onClick={() => toggle(c.id, c.enabled)} className="text-xs text-[var(--muted)] hover:underline">
                  {c.enabled ? "Disable" : "Enable"}
                </button>
                <button onClick={() => remove(c.id)} className="text-xs text-[var(--muted)] hover:underline">
                  Remove
                </button>
              </span>
            </div>
          ))
        )}
      </div>
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
  const [scope, setScope] = useState<"read" | "read-write">("read-write");
  const [expiresInDays, setExpiresInDays] = useState<string>("90");
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
      body: JSON.stringify({
        name: name.trim(),
        scope,
        expiresInDays: expiresInDays === "never" ? null : Number(expiresInDays),
      }),
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

  function keyStatus(k: ApiKeyRow): string {
    if (k.revoked) return "revoked";
    if (k.expired) return "expired";
    return k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleString("en-US")}` : "never used";
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Public API keys
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Real REST surface at <code className="font-mono">/api/public/use-cases</code> (GET list, POST create) -
        authenticate with <code className="font-mono">Authorization: Bearer &lt;key&gt;</code>. Read-only keys
        can list/query but can&apos;t create or mutate anything; keys are checked for expiry on every call.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. which external system)" className="min-w-[220px] flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
        <select value={scope} onChange={(e) => setScope(e.target.value as "read" | "read-write")} className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
          <option value="read-write">Read/write</option>
          <option value="read">Read only</option>
        </select>
        <select value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
          <option value="30">Expires in 30 days</option>
          <option value="90">Expires in 90 days</option>
          <option value="365">Expires in 365 days</option>
          <option value="never">Never expires</option>
        </select>
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
                  {k.scope} &middot; {k.expiresAt ? `expires ${new Date(k.expiresAt).toLocaleDateString("en-US")}` : "never expires"} &middot; {keyStatus(k)}
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

function EscalationSection() {
  const [result, setResult] = useState<{ checked: number; escalated: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/escalate-stale-approvals", { method: "POST" });
      const data = await res.json();
      if (res.ok) setResult(data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Stale ARB approval escalation
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Real daily nag - re-sends a Slack alert for every Critical-tier use case whose ARB approval has been
        pending 5+ days, using the real timestamp of when it first got stuck. Runs automatically daily via
        Vercel Cron, or trigger it manually here.
      </p>
      <button onClick={run} disabled={busy} className="mt-3 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Running..." : "Check for stale approvals now"}
      </button>
      {result && (
        <p className="mt-2 text-xs text-[var(--muted)]">
          Checked {result.checked} pending approval(s), escalated {result.escalated}.
        </p>
      )}
    </div>
  );
}

interface AccessRow {
  id: string;
  name: string;
  email: string;
  role: string;
  roleRecertifiedAt: string | null;
  daysSinceLastCheck: number;
  overdue: boolean;
}

function AccessRecertificationSection() {
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [intervalDays, setIntervalDays] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/access-recertification")
      .then((r) => r.json())
      .then((d) => {
        setRows(d.users ?? []);
        setIntervalDays(d.recertIntervalDays ?? null);
      });
  }
  useEffect(load, []);

  async function recertify(userId: string) {
    setBusyId(userId);
    try {
      await fetch("/api/admin/access-recertification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Access &amp; role recertification
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Every account holding governance-owner, ARB, or admin rights - real joiner-mover-leaver hygiene,
        separate from recertifying an individual use case.
        {intervalDays && ` Flagged overdue after ${intervalDays} days since last review.`}
      </p>
      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No elevated-role accounts yet.</p>
        ) : (
          rows.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <span>
                <span className="font-semibold">{u.name}</span>{" "}
                <span className="text-xs text-[var(--muted)]">
                  {u.email} &middot; {u.role} &middot;{" "}
                  {u.roleRecertifiedAt
                    ? `last recertified ${new Date(u.roleRecertifiedAt).toLocaleDateString("en-US")}`
                    : "never recertified"}
                </span>
                {u.overdue && (
                  <span className="ml-2 rounded-full bg-[var(--tier-critical-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--tier-critical)]">
                    Overdue ({u.daysSinceLastCheck}d)
                  </span>
                )}
              </span>
              <button
                onClick={() => recertify(u.id)}
                disabled={busyId === u.id}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold transition-colors hover:bg-[var(--surface)] disabled:opacity-60"
              >
                {busyId === u.id ? "Recertifying..." : "Recertify"}
              </button>
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

interface GovernanceBaselineRow {
  riskTier: "Low" | "Medium" | "High" | "Critical";
  baselineHours: number | null;
  costPerHourUsd: number | null;
  updatedAt: string | null;
  updatedByName: string | null;
}

function GovernanceBaselineSection() {
  const [rows, setRows] = useState<GovernanceBaselineRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { baselineHours: string; costPerHourUsd: string }>>({});
  const [savingTier, setSavingTier] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/governance-baseline")
      .then((r) => r.json())
      .then((d) => {
        const loaded: GovernanceBaselineRow[] = d.baselines ?? [];
        setRows(loaded);
        setDrafts(
          Object.fromEntries(
            loaded.map((r) => [
              r.riskTier,
              { baselineHours: r.baselineHours != null ? String(r.baselineHours) : "", costPerHourUsd: r.costPerHourUsd != null ? String(r.costPerHourUsd) : "" },
            ])
          )
        );
      });
  }
  useEffect(load, []);

  async function save(riskTier: string) {
    const draft = drafts[riskTier];
    if (!draft || !draft.baselineHours) return;
    setSavingTier(riskTier);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/governance-baseline", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          riskTier,
          baselineHours: Number(draft.baselineHours),
          costPerHourUsd: draft.costPerHourUsd ? Number(draft.costPerHourUsd) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`Saved baseline for ${riskTier}.`);
      load();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSavingTier(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Governance baseline &amp; time saved
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Declare how long the manual process used to take (and optionally its cost/hour) per risk tier. Once
        set, use cases that clear the Governance Gate show real elapsed time compared against this honest,
        admin-declared assumption &mdash; never presented as a measured fact.
      </p>
      <div className="mt-4 space-y-2">
        {rows.map((r) => {
          const draft = drafts[r.riskTier] ?? { baselineHours: "", costPerHourUsd: "" };
          return (
            <div key={r.riskTier} className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <span className="w-20 font-semibold">{r.riskTier}</span>
              <input
                value={draft.baselineHours}
                onChange={(e) => setDrafts((d) => ({ ...d, [r.riskTier]: { ...draft, baselineHours: e.target.value } }))}
                type="number"
                placeholder="Baseline hours"
                className="w-36 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
              <input
                value={draft.costPerHourUsd}
                onChange={(e) => setDrafts((d) => ({ ...d, [r.riskTier]: { ...draft, costPerHourUsd: e.target.value } }))}
                type="number"
                placeholder="Cost/hour USD (optional)"
                className="w-44 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
              <button
                onClick={() => save(r.riskTier)}
                disabled={savingTier === r.riskTier || !draft.baselineHours}
                className="rounded-full bg-[var(--brand)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {savingTier === r.riskTier ? "Saving..." : "Save"}
              </button>
              <span className="text-xs text-[var(--muted)]">
                {r.updatedAt ? `set by ${r.updatedByName ?? "unknown"} on ${new Date(r.updatedAt).toLocaleDateString("en-US")}` : "not set"}
              </span>
            </div>
          );
        })}
      </div>
      {message && <p className="mt-2 text-xs text-[var(--muted)]">{message}</p>}
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Admin Console</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Real platform configuration &mdash; notifications, budgets, public API access, and data retention.
          </p>
        </div>
        <Link
          href="/admin/overview"
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
        >
          View overview dashboard &rarr;
        </Link>
      </div>
      <KnowledgeBaseSection />
      <NotificationSection />
      <GovernanceBaselineSection />
      <BudgetsSection />
      <ApiKeysSection />
      <AccessRecertificationSection />
      <EscalationSection />
      <RetentionSection />
    </div>
  );
}
