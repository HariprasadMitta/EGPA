"use client";

import { useState } from "react";

// Small hand-rolled SVG charts for the Observability page, following the
// dataviz skill's mark specs at this app's scale (thin marks, rounded
// data-ends, a hover layer, direct labels instead of a legend when there's
// only ever one series per chart). Categorical hues come from the fixed
// --series-1..8 slots in globals.css (validated against this app's own
// surfaces), never reassigned by filtering.

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-bold text-[var(--brand-strong)]">{value}</p>
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

  return (
    <div className="space-y-2.5">
      {data.map((d, i) => {
        const color = colorFor ? colorFor(d.label, i) : SERIES_COLORS[i % SERIES_COLORS.length];
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
