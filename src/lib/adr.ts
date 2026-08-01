import { GovernanceGate, Recommendation, RiskComplianceDetails, UseCase } from "@/types";
import { GOVERNANCE_TEMPLATES } from "@/lib/governance";

function riskComplianceSection(rcd: RiskComplianceDetails | null): string {
  if (!rcd) return "";
  return `

## Risk & Compliance Profile

Captured on the deeper Intake questionnaire - real due-diligence
documentation. Only two fields here (human oversight frequency,
customer-impact decision) feed the computed risk tier above; the rest are
recorded as governance facts without being force-fit into the numeric score.

- **Regulatory frameworks applicable:** ${rcd.regulatoryFrameworks.length ? rcd.regulatoryFrameworks.join(", ") : "None declared"}
- **Data residency:** ${rcd.dataResidency}
- **Data sources:** ${rcd.dataSources.join(", ")}
- **Sensitive data elements:** ${rcd.sensitiveDataElements}
- **Retention:** inputs ${rcd.retentionInputsDays != null ? `${rcd.retentionInputsDays}d` : "not specified"} / outputs ${rcd.retentionOutputsDays != null ? `${rcd.retentionOutputsDays}d` : "not specified"} / logs ${rcd.retentionLogsDays != null ? `${rcd.retentionLogsDays}d` : "not specified"}
- **Model sourcing:** ${rcd.modelSourcing === "third-party-api" ? "Third-party API" : "In-house / fine-tuned"} (${rcd.modelVendor})
- **Directly makes/influences a customer decision (credit, claims, pricing):** ${rcd.customerImpactDecision ? "Yes - real scoring input" : "No"}
- **Human oversight frequency:** ${rcd.humanOversightFrequency}${rcd.humanReviewSamplePercent != null ? ` (${rcd.humanReviewSamplePercent}% sampled)` : ""} - real scoring input
- **Accountable escalation owner:** ${rcd.escalationOwner}
- **Explainability requirement:** ${rcd.explainabilityRequirement}
- **Bias/fairness testing plan:** ${rcd.biasFairnessTestingPlan}
- **Pre-production validation:** ${rcd.preProductionValidation}
- **Expected usage volume:** ${rcd.expectedUsageVolume}
- **Business criticality / SLA:** ${rcd.businessCriticality}
- **Fallback / rollback plan:** ${rcd.fallbackRollbackPlan}
- **Encrypted at rest and in transit:** ${rcd.encryptedAtRestInTransit ? "Yes" : "No"}
- **Agent has write access to production systems:** ${rcd.agentWriteAccessProduction ? "Yes" : "No"}
- **Security review completed before go-live:** ${rcd.securityReviewCompleted ? "Yes" : "No - blocking"}
- **Accountable owner if this agent causes harm:** ${rcd.accountableOwner}
- **Affected users told they're interacting with an AI system:** ${rcd.usersToldAboutAi ? "Yes" : "No"}
`;
}

export function buildADRContent(
  useCase: UseCase,
  recommendation: Recommendation,
  gate: GovernanceGate,
  version: number,
  riskComplianceDetails: RiskComplianceDetails | null = null
): string {
  const template = GOVERNANCE_TEMPLATES[useCase.riskTier];
  const createdAt = new Date().toISOString();

  return `# Architecture Decision Record: ${useCase.title}

**Status:** ${gate.acknowledged ? "Approved" : "Pending governance sign-off"}
**Version:** v${version} (governance template v${template.version}, supersedes v${template.supersedes ?? "-"})
**Date:** ${createdAt}
**Owner:** ${useCase.owner}
**Steward:** ${useCase.steward}

## Use Case

${useCase.description}

- **Business domain:** ${useCase.businessDomain}
- **Data sensitivity:** ${useCase.dataSensitivity}
- **Agent autonomy level:** ${useCase.autonomyLevel}
- **Integration surface:** ${useCase.integrationSurface}
- **Expected users:** ${useCase.expectedUsers}

## Risk Classification (OSCAR - Classification)

**Computed risk tier: ${useCase.riskTier}**

This tier was computed deterministically from data sensitivity, agent autonomy,
and blast radius. It was not selected by the requester.

## Recommendation

- **Framework:** ${recommendation.framework}
- **Tool stack:** ${recommendation.tools.join(", ")}
- **Harness pattern:** ${recommendation.harnessPattern}
- **Loop pattern:** ${recommendation.loopPattern} (iteration ceiling: ${recommendation.iterationCeiling})
- **Context window strategy:** ${recommendation.contextStrategy}

**Rationale:**

${recommendation.rationale}

## Governance Gate (OSCAR - Ownership, Stewardship, Auditability)

- **HITL tier:** ${gate.hitlTier}
- **Required approvals:** ${template.requiredApprovals.join(", ")}
- **Required controls:**
${gate.requiredControls.map((c) => `  - ${c}`).join("\n")}
- **Acknowledged:** ${gate.acknowledged ? "Yes - all required items confirmed" : "No - blocking"}${
    gate.requiresArbApproval
      ? `\n- **Architecture Review Board sign-off:** ${
          gate.arbApproved
            ? `Approved by ${gate.arbApprovedBy} on ${gate.arbApprovedAt}`
            : "Pending - blocking"
        }`
      : ""
  }
- **Recertification interval:** ${template.recertificationDays ? `${template.recertificationDays} days` : "Not required at this tier"}

## Retain-and-Reinvent

This governance template is versioned (v${template.version}), superseding v${template.supersedes ?? "-"}.
Standards evolve; this ADR reflects the ruleset in effect at time of decision, not
an immutable requirement.
${riskComplianceSection(riskComplianceDetails)}
---
*Auto-generated by the Enterprise AI Governance & Framework Advisor. Traceable to OSCAR framework sections O/S/C/A/R.*
`;
}
