"use client";

import { useMemo, useState } from "react";
import { MCP_SERVERS, MODEL_REGISTRY } from "@/lib/modelRegistry";
import { ModelStatus, RiskTier } from "@/types";
import { RiskBadge } from "@/components/RiskBadge";

const STATUS_STYLES: Record<ModelStatus, string> = {
  approved: "text-[var(--tier-low)] bg-[var(--tier-low-bg)]",
  "under-review": "text-[var(--tier-medium)] bg-[var(--tier-medium-bg)]",
  deprecated: "text-[var(--muted)] bg-[var(--background)]",
};

const RISK_TIERS: RiskTier[] = ["Low", "Medium", "High", "Critical"];

export default function RegistryPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ModelStatus | "all">("all");
  const [tierFilter, setTierFilter] = useState<RiskTier | "all">("all");

  const filtered = useMemo(() => {
    return MODEL_REGISTRY.filter((m) => {
      if (query && !`${m.name} ${m.vendor}`.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (tierFilter !== "all" && !m.allowedRiskTiers.includes(tierFilter)) return false;
      return true;
    });
  }, [query, statusFilter, tierFilter]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Model Registry</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Seeded sample data. In the connected version, this table syncs
            live from the AI Gateway&apos;s model allowlist.
          </p>
        </div>
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
          Simulated registry
        </span>
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
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[m.status]}`}
                  >
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
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
          Simulated registry
        </span>
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
            {MCP_SERVERS.map((m) => (
              <tr key={m.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-semibold">{m.name}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{m.publisher}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{m.description}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[m.status]}`}
                  >
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
