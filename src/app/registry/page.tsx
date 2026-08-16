"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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
  changeReason: string | null;
}

interface McpEntry {
  id: string;
  name: string;
  publisher: string;
  description: string;
  status: ModelStatus;
  allowedRiskTiers: RiskTier[];
  changeReason: string | null;
}

function AddModelForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", vendor: "", version: "", status: "under-review" as ModelStatus });
  const [tiers, setTiers] = useState<RiskTier[]>([]);
  const [changeReason, setChangeReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.id || !form.name || !form.vendor || !form.version) {
      setError("id, name, vendor, and version are required.");
      return;
    }
    if (!changeReason.trim()) {
      setError("A reason is required - why is this model being added at this status/tier scope?");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/model-registry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, allowedRiskTiers: tiers, changeReason: changeReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ id: "", name: "", vendor: "", version: "", status: "under-review" });
      setTiers([]);
      setChangeReason("");
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
      <textarea
        value={changeReason}
        onChange={(e) => setChangeReason(e.target.value)}
        placeholder="Reason - why add this model at this status/tier scope?"
        rows={2}
        className="sm:col-span-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
      />
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

function AddMcpServerForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", publisher: "", description: "", status: "under-review" as ModelStatus });
  const [tiers, setTiers] = useState<RiskTier[]>([]);
  const [changeReason, setChangeReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.id || !form.name || !form.publisher || !form.description) {
      setError("id, name, publisher, and description are required.");
      return;
    }
    if (!changeReason.trim()) {
      setError("A reason is required - why is this MCP server being added at this status/tier scope?");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/mcp-servers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, allowedRiskTiers: tiers, changeReason: changeReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ id: "", name: "", publisher: "", description: "", status: "under-review" });
      setTiers([]);
      setChangeReason("");
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
        + Add MCP server
      </button>
    );
  }

  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 sm:grid-cols-2">
      <input placeholder="id (e.g. github-mcp)" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm" />
      <input placeholder="Display name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm" />
      <input placeholder="Publisher" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm" />
      <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ModelStatus })} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm">
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <textarea
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder="Description - what tools does this MCP server expose?"
        rows={2}
        className="sm:col-span-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {RISK_TIERS.map((t) => (
          <label key={t} className="flex items-center gap-1">
            <input type="checkbox" checked={tiers.includes(t)} onChange={() => setTiers((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])} />
            {t}
          </label>
        ))}
      </div>
      <textarea
        value={changeReason}
        onChange={(e) => setChangeReason(e.target.value)}
        placeholder="Reason - why add this MCP server at this status/tier scope?"
        rows={2}
        className="sm:col-span-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
      />
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

  const [pendingChange, setPendingChange] = useState<{ id: string; status: ModelStatus } | null>(null);
  const [pendingReason, setPendingReason] = useState("");
  const [pendingBusy, setPendingBusy] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const [pendingMcpChange, setPendingMcpChange] = useState<{ id: string; status: ModelStatus } | null>(null);
  const [pendingMcpReason, setPendingMcpReason] = useState("");
  const [pendingMcpBusy, setPendingMcpBusy] = useState(false);
  const [pendingMcpError, setPendingMcpError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/model-registry").then((r) => r.json()).then((d) => setModels(d.entries ?? []));
    fetch("/api/admin/mcp-servers").then((r) => r.json()).then((d) => setServers(d.entries ?? []));
  }

  useEffect(load, []);

  async function confirmModelStatus() {
    if (!pendingChange) return;
    if (!pendingReason.trim()) {
      setPendingError("A reason is required when changing a model's status.");
      return;
    }
    setPendingBusy(true);
    setPendingError(null);
    try {
      const res = await fetch(`/api/admin/model-registry/${pendingChange.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: pendingChange.status, changeReason: pendingReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendingChange(null);
      setPendingReason("");
      load();
    } catch (err) {
      setPendingError((err as Error).message);
    } finally {
      setPendingBusy(false);
    }
  }

  async function confirmMcpStatus() {
    if (!pendingMcpChange) return;
    if (!pendingMcpReason.trim()) {
      setPendingMcpError("A reason is required when changing an MCP server's status.");
      return;
    }
    setPendingMcpBusy(true);
    setPendingMcpError(null);
    try {
      const res = await fetch(`/api/admin/mcp-servers/${pendingMcpChange.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: pendingMcpChange.status, changeReason: pendingMcpReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendingMcpChange(null);
      setPendingMcpReason("");
      load();
    } catch (err) {
      setPendingMcpError((err as Error).message);
    } finally {
      setPendingMcpBusy(false);
    }
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
              <th className="px-4 py-3">Reason on file</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <Fragment key={m.id}>
                <tr className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-semibold">{m.name}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{m.vendor}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{m.version}</td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <select
                        value={m.status}
                        onChange={(e) => {
                          const status = e.target.value as ModelStatus;
                          if (status === m.status) return;
                          setPendingChange({ id: m.id, status });
                          setPendingReason("");
                          setPendingError(null);
                        }}
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
                  <td className="px-4 py-3 max-w-xs text-xs text-[var(--muted)]" title={m.changeReason ?? ""}>
                    {m.changeReason ? (m.changeReason.length > 80 ? `${m.changeReason.slice(0, 80)}...` : m.changeReason) : "Not captured"}
                  </td>
                </tr>
                {pendingChange?.id === m.id && (
                  <tr className="border-b border-[var(--border)] bg-[var(--background)] last:border-0">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold">
                          Changing status to <strong>{pendingChange.status}</strong> - reason required:
                        </span>
                        <input
                          value={pendingReason}
                          onChange={(e) => setPendingReason(e.target.value)}
                          placeholder="Why is this status changing?"
                          className="min-w-[220px] flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
                        />
                        <button
                          onClick={confirmModelStatus}
                          disabled={pendingBusy}
                          className="rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {pendingBusy ? "Saving..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => {
                            setPendingChange(null);
                            setPendingReason("");
                            setPendingError(null);
                          }}
                          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                      {pendingError && <p className="mt-2 text-xs text-[var(--tier-critical)]">{pendingError}</p>}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
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
        {isAdmin && <AddMcpServerForm onAdded={load} />}
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
              <th className="px-4 py-3">Reason on file</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((m) => (
              <Fragment key={m.id}>
                <tr className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-semibold">{m.name}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{m.publisher}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{m.description}</td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <select
                        value={m.status}
                        onChange={(e) => {
                          const status = e.target.value as ModelStatus;
                          if (status === m.status) return;
                          setPendingMcpChange({ id: m.id, status });
                          setPendingMcpReason("");
                          setPendingMcpError(null);
                        }}
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
                  <td className="px-4 py-3 max-w-xs text-xs text-[var(--muted)]" title={m.changeReason ?? ""}>
                    {m.changeReason ? (m.changeReason.length > 80 ? `${m.changeReason.slice(0, 80)}...` : m.changeReason) : "Not captured"}
                  </td>
                </tr>
                {pendingMcpChange?.id === m.id && (
                  <tr className="border-b border-[var(--border)] bg-[var(--background)] last:border-0">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold">
                          Changing status to <strong>{pendingMcpChange.status}</strong> - reason required:
                        </span>
                        <input
                          value={pendingMcpReason}
                          onChange={(e) => setPendingMcpReason(e.target.value)}
                          placeholder="Why is this status changing?"
                          className="min-w-[220px] flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
                        />
                        <button
                          onClick={confirmMcpStatus}
                          disabled={pendingMcpBusy}
                          className="rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {pendingMcpBusy ? "Saving..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => {
                            setPendingMcpChange(null);
                            setPendingMcpReason("");
                            setPendingMcpError(null);
                          }}
                          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                      {pendingMcpError && <p className="mt-2 text-xs text-[var(--tier-critical)]">{pendingMcpError}</p>}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {servers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  No MCP servers registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
