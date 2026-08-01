"use client";

import { useState } from "react";

// Small hand-rolled SVG charts for the Observability page, following the
// dataviz skill's mark specs at this app's scale (thin marks, rounded
// data-ends, a hover layer, direct labels instead of a legend when there's
// only ever one series per chart). Categorical hues come from the fixed
// --series-1..8 slots in globals.css (validated against this app's own
// surfaces), never reassigned by filtering.

// Status color (not categorical) for a state like success/error rate - this
// app's existing status language (--status-done / --tier-medium /
// --tier-critical), reused rather than a new palette, same rule as the
// dataviz skill's "status colors are reserved, never a series hue."
export type StatTone = "good" | "warning" | "critical";

const TONE_COLOR: Record<StatTone, string> = {
  good: "var(--status-done)",
  warning: "var(--tier-medium)",
  critical: "var(--tier-critical)",
};

export function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: StatTone;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-bold" style={{ color: tone ? TONE_COLOR[tone] : "var(--brand-strong)" }}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

export function SparkLineChart({
  data,
  color = "var(--series-1)",
  valueFormatter = (v: number) => v.toLocaleString("en-US"),
  height = 140,
}: {
  data: { date: string; value: number }[];
  color?: string;
  valueFormatter?: (v: number) => string;
  height?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 480;
  const padX = 12;
  const padY = 16;

  if (data.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No real data yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;
  const points = data.map((d, i) => ({
    x: padX + i * stepX,
    y: height - padY - (d.value / max) * (height - padY * 2),
    ...d,
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width;
          let nearest = 0;
          let best = Infinity;
          points.forEach((p, i) => {
            const d = Math.abs(p.x - relX);
            if (d < best) {
              best = d;
              nearest = i;
            }
          });
          setHoverIdx(nearest);
        }}
      >
        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="var(--chart-grid)" strokeWidth={1} />
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={p.x}
            cy={p.y}
            r={hoverIdx === i ? 5 : 3}
            fill={color}
            stroke="var(--surface)"
            strokeWidth={1.5}
          />
        ))}
        {hovered && <line x1={hovered.x} y1={padY} x2={hovered.x} y2={height - padY} stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />}
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute top-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs shadow-md" style={{ left: `${(hovered.x / width) * 100}%`, transform: "translateX(-50%)" }}>
          <p className="font-semibold">{hovered.date}</p>
          <p className="text-[var(--muted)]">{valueFormatter(hovered.value)}</p>
        </div>
      )}
    </div>
  );
}

// Legend row above a chart, Neon-monitoring style: a small caption (unit)
// on the left, colored-square + label badges on the right.
export function ChartLegend({
  caption,
  items,
}: {
  caption: string;
  items: { label: string; color: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[var(--border)] pb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
      <span>{caption}</span>
      <div className="flex flex-wrap items-center gap-3">
        {items.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 flex-none rounded-[2px]" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface AreaSeriesKey {
  key: string;
  label: string;
  color: string;
}

// Stacked area chart, Neon-monitoring-dashboard style (their RAM chart:
// ALLOCATED/USED/CACHED stacked with gridlines and a hover readout) - real
// per-bucket values stacked bottom-up, a hover crosshair reading every
// series' value at that point, and a 2px surface gap between fills per the
// dataviz skill's mark spec.
export function StackedAreaChart({
  data,
  seriesKeys,
  valueFormatter = (v: number) => v.toLocaleString("en-US"),
  height = 180,
}: {
  data: { date: string; values: Record<string, number> }[];
  seriesKeys: AreaSeriesKey[];
  valueFormatter?: (v: number) => string;
  height?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 560;
  const padX = 12;
  const padY = 18;
  const padLeft = 44;

  if (data.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No real data yet.</p>;
  }

  const totals = data.map((d) => seriesKeys.reduce((sum, s) => sum + (d.values[s.key] ?? 0), 0));
  const max = Math.max(...totals, 1);
  const plotW = width - padLeft - padX;
  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;

  // Cumulative stack per point, bottom series first.
  const stacked = data.map((d) => {
    let running = 0;
    return seriesKeys.map((s) => {
      const from = running;
      running += d.values[s.key] ?? 0;
      return { from, to: running };
    });
  });

  function yFor(v: number) {
    return padY + (height - padY * 2) * (1 - v / max);
  }

  const areaPaths = seriesKeys.map((s, sIdx) => {
    const top = data.map((_, i) => ({ x: padLeft + i * stepX, y: yFor(stacked[i][sIdx].to) }));
    const bottom = data.map((_, i) => ({ x: padLeft + i * stepX, y: yFor(stacked[i][sIdx].from) }));
    const forward = top.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const backward = [...bottom].reverse().map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    return { key: s.key, color: s.color, d: `${forward} ${backward} Z` };
  });

  const yTicks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const hoveredX = hoverIdx !== null ? padLeft + hoverIdx * stepX : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width;
          let nearest = 0;
          let best = Infinity;
          data.forEach((_, i) => {
            const x = padLeft + i * stepX;
            const d = Math.abs(x - relX);
            if (d < best) {
              best = d;
              nearest = i;
            }
          });
          setHoverIdx(nearest);
        }}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={padLeft} y1={yFor(t)} x2={width - padX} y2={yFor(t)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={padLeft - 6} y={yFor(t) + 3} textAnchor="end" fontSize={9} fill="var(--muted)">
              {t.toLocaleString("en-US")}
            </text>
          </g>
        ))}
        {areaPaths.map((a) => (
          <path key={a.key} d={a.d} fill={a.color} fillOpacity={0.55} stroke={a.color} strokeWidth={1.5} strokeOpacity={0.9} />
        ))}
        {hoveredX !== null && (
          <line x1={hoveredX} y1={padY} x2={hoveredX} y2={height - padY} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
        )}
      </svg>
      {hoverIdx !== null && (
        <div
          className="pointer-events-none absolute top-0 min-w-[9rem] rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: `${Math.min(Math.max((hoveredX! / width) * 100, 15), 85)}%`,
            transform: "translateX(-50%)",
          }}
        >
          <p className="font-semibold">{data[hoverIdx].date}</p>
          {seriesKeys.map((s) => (
            <p key={s.key} className="flex items-center gap-1.5 text-[var(--muted)]">
              <span className="h-1.5 w-1.5 flex-none rounded-[1px]" style={{ backgroundColor: s.color }} />
              {s.label}: {valueFormatter(data[hoverIdx].values[s.key] ?? 0)}
            </p>
          ))}
        </div>
      )}
      <div className="mt-1 flex justify-between text-[10px] text-[var(--muted)]">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export type TimeRangeKey = "24h" | "7d" | "all";

const TIME_RANGES: { key: TimeRangeKey; label: string }[] = [
  { key: "24h", label: "Last 24 hours" },
  { key: "7d", label: "Last 7 days" },
  { key: "all", label: "All time" },
];

// Pill-style range selector + refresh button, matching the reference
// monitoring dashboard's "Last hour / Last day / Other" + refresh control -
// real filtering of already-fetched real data (see filterByRange below),
// not a decorative control.
export function TimeRangeControls({
  value,
  onChange,
  onRefresh,
  refreshing,
}: {
  value: TimeRangeKey;
  onChange: (v: TimeRangeKey) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex overflow-hidden rounded-full border border-[var(--border)]">
        {TIME_RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => onChange(r.key)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              value === r.key
                ? "bg-[var(--brand)] text-white"
                : "bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--background)]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}>
          <path d="M4 12a8 8 0 0 1 14.5-4.6M20 12a8 8 0 0 1-14.5 4.6" strokeLinecap="round" />
          <path d="M18.5 3v4.5H14M5.5 21v-4.5H10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Refresh
      </button>
    </div>
  );
}

export function filterByRange<T extends { date: string }>(rows: T[], range: TimeRangeKey): T[] {
  if (range === "all") return rows;
  const days = range === "24h" ? 1 : 7;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  return rows.filter((r) => r.date >= cutoffKey);
}

const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

export function HorizontalBarChart({
  data,
  valueFormatter = (v: number) => v.toLocaleString("en-US"),
  colorFor,
}: {
  data: { label: string; value: number }[];
  valueFormatter?: (v: number) => string;
  colorFor?: (label: string, index: number) => string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No real data yet.</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  // Color follows the entity, never its display rank: `data` is typically
  // sorted by value for the bar order, but the color index comes from a
  // fixed alphabetical ordering of the labels so a series keeps its color
  // even if its rank moves between renders.
  const stableOrder = [...data.map((d) => d.label)].sort();

  return (
    <div className="space-y-2.5">
      {data.map((d) => {
        const stableIndex = stableOrder.indexOf(d.label);
        const color = colorFor ? colorFor(d.label, stableIndex) : SERIES_COLORS[stableIndex % SERIES_COLORS.length];
        const pct = Math.max((d.value / max) * 100, 2);
        return (
          <div key={d.label}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium" title={d.label}>
                {d.label}
              </span>
              <span className="flex-none text-[var(--muted)]">{valueFormatter(d.value)}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--chart-grid)]">
              <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function riskTierColor(tier: string): string {
  const key = tier.toLowerCase();
  if (key === "low" || key === "medium" || key === "high" || key === "critical") {
    return `var(--tier-${key})`;
  }
  return "var(--muted)";
}
