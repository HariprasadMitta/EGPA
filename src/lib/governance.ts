import {
  AutonomyLevel,
  DataSensitivity,
  GovernanceTemplate,
  IntegrationSurface,
  RiskTier,
} from "@/types";

// Shared by both the human-driven executions route and the webhook trigger
// route (src/lib/executionPersistence.ts) so a use case's governance gate is
// enforced identically no matter which entry point starts a run.
export function isGateEligible(
  gate: { acknowledged: boolean; requiresArbApproval: boolean; arbApproved: boolean } | null | undefined
): boolean {
  return Boolean(gate?.acknowledged) && (!gate?.requiresArbApproval || Boolean(gate?.arbApproved));
}

const SENSITIVITY_SCORE: Record<DataSensitivity, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  regulated: 3,
};

const AUTONOMY_SCORE: Record<AutonomyLevel, number> = {
  "suggest-only": 0,
  "human-approves-each-action": 1,
  "human-approves-batches": 2,
  "fully-autonomous": 3,
};

const BLAST_RADIUS_SCORE: Record<IntegrationSurface, number> = {
  "read-only-internal": 0,
  "read-write-internal": 1,
  "external-customer-facing": 2,
  "external-financial-or-safety": 3,
};

/**
 * Deterministic OSCAR "Classification" scoring: data sensitivity x agent
 * autonomy x blast radius. Weighted so autonomy and blast radius dominate a
 * single high sensitivity score, matching the spec's "computed, not selected"
 * requirement.
 */
export function classifyRisk(input: {
  dataSensitivity: DataSensitivity;
  autonomyLevel: AutonomyLevel;
  integrationSurface: IntegrationSurface;
}): RiskTier {
  const score =
    SENSITIVITY_SCORE[input.dataSensitivity] * 1 +
    AUTONOMY_SCORE[input.autonomyLevel] * 1.5 +
    BLAST_RADIUS_SCORE[input.integrationSurface] * 1.5;

  if (score >= 10) return "Critical";
  if (score >= 6.5) return "High";
  if (score >= 3) return "Medium";
  return "Low";
}

export const GOVERNANCE_TEMPLATES: Record<RiskTier, GovernanceTemplate> = {
  Low: {
    riskTier: "Low",
    requiredApprovals: ["Owner self-attest"],
    requiredControls: ["Usage logging"],
    hitlTier: "none",
    recertificationDays: null,
    version: 2,
    supersedes: 1,
    requiresArbApproval: false,
  },
  Medium: {
    riskTier: "Medium",
    requiredApprovals: ["Owner self-attest", "Steward review"],
    requiredControls: [
      "Usage logging",
      "PII masking",
      "Rate limiting on tool calls",
    ],
    hitlTier: "advisory",
    recertificationDays: 180,
    version: 2,
    supersedes: 1,
    requiresArbApproval: false,
  },
  High: {
    riskTier: "High",
    requiredApprovals: ["Owner", "Steward", "Governance Owner"],
    requiredControls: [
      "Audit logging",
      "PII masking",
      "HITL approval step",
      "Tool allowlist enforcement",
      "Drift monitoring",
    ],
    hitlTier: "approval-required",
    recertificationDays: 90,
    version: 3,
    supersedes: 2,
    requiresArbApproval: false,
  },
  Critical: {
    riskTier: "Critical",
    requiredApprovals: [
      "Owner",
      "Steward",
      "Governance Owner",
      "Named Reviewer (ARB)",
    ],
    requiredControls: [
      "Audit logging",
      "PII masking",
      "Manual HITL on every action",
      "Tool allowlist enforcement",
      "Drift monitoring",
      "Kill-switch / circuit breaker",
      "Named on-call escalation path",
    ],
    hitlTier: "manual",
    recertificationDays: 30,
    version: 3,
    supersedes: 2,
    requiresArbApproval: true,
  },
};
