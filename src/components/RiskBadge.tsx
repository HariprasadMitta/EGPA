import { RiskTier } from "@/types";

const TIER_STYLES: Record<RiskTier, string> = {
  Low: "text-[var(--tier-low)] bg-[var(--tier-low-bg)] border-[var(--tier-low)]/30",
  Medium: "text-[var(--tier-medium)] bg-[var(--tier-medium-bg)] border-[var(--tier-medium)]/30",
  High: "text-[var(--tier-high)] bg-[var(--tier-high-bg)] border-[var(--tier-high)]/30",
  Critical: "text-[var(--tier-critical)] bg-[var(--tier-critical-bg)] border-[var(--tier-critical)]/30",
};

export function RiskBadge({ tier, className = "" }: { tier: RiskTier; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${TIER_STYLES[tier]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {tier} risk
    </span>
  );
}
