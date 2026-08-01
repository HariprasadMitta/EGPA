import {
  AutonomyLevel,
  DataSensitivity,
  GovernanceTemplate,
  HumanOversightFrequency,
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

// Same spirit as AUTONOMY_SCORE - "exception-only" review scores like the
// least-supervised autonomy option ("fully-autonomous") does today, since
// asking how often a human actually looks at output is closely related to
// asking how autonomous the agent is.
const HUMAN_OVERSIGHT_SCORE: Record<HumanOversightFrequency, number> = {
  "full-review": 0,
  sampled: 1.5,
  "exception-only": 3,
};

// Same scale as the top BLAST_RADIUS_SCORE value - a use case that directly
// makes/influences a customer decision (credit, claims, pricing) is asking a
// closely related real question to "external-financial-or-safety" more
// directly, so it's weighted the same.
const CUSTOMER_IMPACT_SCORE = 3;

/**
 * Deterministic OSCAR "Classification" scoring: data sensitivity x agent
 * autonomy x blast radius, plus (once the deeper Intake questionnaire has
 * been answered) human oversight frequency and customer-impact decision -
 * two more genuinely risk-correlated inputs, weighted the same as the
 * existing inputs they most closely mirror. Fields like "which vendor" or
 * "retention period" are real governance facts worth capturing (see
 * RiskComplianceDetails) but aren't themselves risk signals, so they don't
 * feed this score - unanswered/undefined inputs here score 0, the safest
 * assumption, not a penalty.
 */
export function classifyRisk(input: {
  dataSensitivity: DataSensitivity;
  autonomyLevel: AutonomyLevel;
  integrationSurface: IntegrationSurface;
  humanOversightFrequency?: HumanOversightFrequency;
  customerImpactDecision?: boolean;
}): RiskTier {
  const score =
    SENSITIVITY_SCORE[input.dataSensitivity] * 1 +
    AUTONOMY_SCORE[input.autonomyLevel] * 1.5 +
    BLAST_RADIUS_SCORE[input.integrationSurface] * 1.5 +
    (input.humanOversightFrequency ? HUMAN_OVERSIGHT_SCORE[input.humanOversightFrequency] : 0) * 1.5 +
    (input.customerImpactDecision ? CUSTOMER_IMPACT_SCORE : 0) * 1.5;

  if (score >= 17) return "Critical";
  if (score >= 11) return "High";
  if (score >= 5) return "Medium";
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
