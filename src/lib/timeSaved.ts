export interface TimeSavedInput {
  createdAt: Date;
  acknowledgedAt: Date | null;
  baselineHours: number | null;
  costPerHourUsd: number | null;
}

export interface TimeSavedResult {
  actualHours: number;
  baselineHours: number;
  hoursSaved: number;
  percentFaster: number;
  costSavedUsd: number | null;
}

// Real elapsed time from Intake submission to Governance Gate clearing,
// compared against an honest, admin-declared baseline (never presented as
// a measured fact - see GovernanceBaseline). Returns null when either the
// gate hasn't cleared yet or no baseline has been set for this risk tier -
// there's nothing real to compute in either case, so this deliberately
// doesn't fall back to a guess.
export function computeTimeSaved(input: TimeSavedInput): TimeSavedResult | null {
  if (!input.acknowledgedAt || input.baselineHours == null) return null;

  const actualMs = input.acknowledgedAt.getTime() - input.createdAt.getTime();
  const actualHours = Math.max(0, actualMs / (1000 * 60 * 60));
  const hoursSaved = Math.max(0, input.baselineHours - actualHours);
  const percentFaster = input.baselineHours > 0 ? (hoursSaved / input.baselineHours) * 100 : 0;
  const costSavedUsd = input.costPerHourUsd != null ? hoursSaved * input.costPerHourUsd : null;

  return {
    actualHours,
    baselineHours: input.baselineHours,
    hoursSaved,
    percentFaster,
    costSavedUsd,
  };
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} hr`;
  return `${(hours / 24).toFixed(1)} days`;
}
