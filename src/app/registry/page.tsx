"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ModelStatus, RiskTier } from "@/types";
import { RiskBadge } from "@/components/RiskBadge";

const STATUS_STYLES: Record<ModelStatus, string> = {
  approved: "text-[var(--tier-low)] bg-[var(--tier-low-bg)]",
  "under-review": "text-[var(--tier-medium)] bg-[var(--tier-medium-bg)]",
  deprecated: "text-[var(--muted)] bg-[var(--background)]",
};

const RISK_TIERS: RiskTier[] = ["Low", "Medium", "High", "Critical"];
const STATUSES: ModelStatus[] = ["approved", "under-review", "deprecated"];

interface ModelEntry {
  id: string;
  name: string;
  vendor: string;
  version: string;
  status: ModelStatus;
  allowedRiskTiers: RiskTier[];
}

interface McpEntry {
  id: string;
  name: string;
  publisher: string;
  description: string;
  status: ModelStatus;
  allowedRiskTiers: RiskTier[];
}

function AddModelForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", vendor: "", version: "", status: "under-review" as ModelStatus });
  const [tiers, setTiers] = useState<RiskTier[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.id || !form.name || !form.vendor || !form.version) {
      setError("id, name, vendor, and version are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/model-registry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, allowedRiskTiers: tiers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ id: "", name: "", vendor: "", version: "", status: "under-review" });
      setTiers([]);
      setOpen(false);
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--background)]"
      >
        + Add model
      </button>
    );
  }

  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 sm:grid-cols-2">
      <input placeholder="id (e.g. gpt-5)" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm" />
      <input placeholder="Display name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm" />
      <input placeholder="Vendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm" />
      <input placeholder="Version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm" />
      <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ModelStatus })} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm">
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {RISK_TIERS.map((t) => (
          <label key={t} className="flex items-center gap-1">
            <input type="checkbox" checked={tiers.includes(t)} onChange={() => setTiers((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])} />
            {t}
          </label>
        ))}
      </div>
      {error && <p className="sm:col-span-2 text-xs text-[var(--tier-critical)]">{error}</p>}
      <div className="sm:col-span-2 flex gap-2">
        <button onClick={submit} disabled={busy} className="rounded-full bg-[var(--brand)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
          {busy ? "Adding..." : "Add"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-full border border-[var(--border)] px-4 py-1.5 text-xs">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function RegistryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [servers, setServers] = useState<McpEntry[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ModelStatus | "all">("all");
  const [tierFilter, setTierFilter] = useState<RiskTier | "all">("all");

  function load() {
    fetch("/api/admin/model-registry").then((r) => r.json()).then((d) => setModels(d.entries ?? []));
    fetch("/api/admin/mcp-servers").then((r) => r.json()).then((d) => setServers(d.entries ?? []));
  }

  useEffect(load, []);

  async function setModelStatus(id: string, status: ModelStatus) {
    await fetch(`/api/admin/model-registry/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  const filtered = useMemo(() => {
    return models.filter((m) => {
      if (query && !`${m.name} ${m.vendor}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (tierFilter !== "all" && !m.allowedRiskTiers.includes(tierFilter)) return false;
      return true;
    });
  }, [models, query, statusFilter, tierFilter]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Model Registry</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Real, DB-backed registry &mdash; Admin can add entries and change status live; every
            other role sees the same real data.
          </p>
        </div>
        {isAdmin && <AddModelForm onAdded={load} />}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search model or vendor..."
          className="min-w-[220px] flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ModelStatus | "all")}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="approved">Approved</option>
          <option value="under-review">Under review</option>
          <option value="deprecated">Deprecated</option>
        </select>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as RiskTier | "all")}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          <option value="all">All risk tiers</option>
          {RISK_TIERS.map((t) => (
            <option key={t} value={t}>
              Allowed for {t}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--background)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Allowed risk tiers</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-semibold">{m.name}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{m.vendor}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{m.version}</td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <select
                      value={m.status}
                      onChange={(e) => setModelStatus(m.id, e.target.value as ModelStatus)}
                      className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[m.status]}`}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[m.status]}`}>
                      {m.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {m.allowedRiskTiers.length === 0 ? (
                    <span className="text-xs text-[var(--muted)]">None</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {m.allowedRiskTiers.map((t) => (
                        <RiskBadge key={t} tier={t} className="px-2 py-0.5 text-[10px]" />
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                  No models match those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-10 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--brand-strong)]">MCP Servers</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Model Context Protocol servers approved for exposing tools to agents &mdash;
            tracked alongside models since a recommendation&apos;s tool stack may be
            served through one of these rather than a bespoke integration.
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--background)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">MCP server</th>
              <th className="px-4 py-3">Publisher</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Allowed risk tiers</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((m) => (
              <tr key={m.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-semibold">{m.name}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{m.publisher}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{m.description}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[m.status]}`}>
                    {m.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {m.allowedRiskTiers.length === 0 ? (
                    <span className="text-xs text-[var(--muted)]">None</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {m.allowedRiskTiers.map((t) => (
                        <RiskBadge key={t} tier={t} className="px-2 py-0.5 text-[10px]" />
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
