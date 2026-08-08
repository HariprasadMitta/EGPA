import { describe, expect, it } from "vitest";
import { buildADRContent } from "@/lib/adr";
import { GovernanceGate, Recommendation, RiskComplianceDetails, UseCase } from "@/types";

const useCase: UseCase = {
  id: "uc-1",
  title: "Test Use Case",
  description: "A use case used purely for ADR content assertions.",
  businessDomain: "Retail Banking",
  dataSensitivity: "confidential",
  autonomyLevel: "human-approves-each-action",
  integrationSurface: "read-write-internal",
  expectedUsers: "department",
  owner: "Owner Person",
  steward: "Steward Person",
  riskTier: "Medium",
  status: "submitted",
  createdAt: "2026-01-01T00:00:00.000Z",
  killSwitchEngaged: false,
  ownerUserId: "user-1",
};

const recommendation: Recommendation = {
  useCaseId: "uc-1",
  framework: "LangGraph",
  tools: ["Internal Data Platform MCP server", "GitHub MCP server"],
  harnessPattern: "Single-agent with tool-calling loop",
  loopPattern: "ReAct with reflection step",
  iterationCeiling: 12,
  contextStrategy: "Sliding window",
  rationale: "Because the risk tier and autonomy level call for it.",
  alternativesConsidered: "A supervisor + worker pattern was considered but rejected as unneeded overhead.",
  createdAt: "2026-01-01T00:00:00.000Z",
  version: 1,
};

const gate: GovernanceGate = {
  useCaseId: "uc-1",
  riskTier: "Medium",
  requiredControls: ["Usage logging", "PII masking", "Rate limiting on tool calls"],
  hitlTier: "advisory",
  acknowledged: false,
  acknowledgedItems: [],
  acknowledgedAt: null,
  requiresArbApproval: false,
  arbApproved: false,
  arbApprovedBy: null,
  arbApprovedAt: null,
  arbApprovalReasoning: null,
};

describe("buildADRContent", () => {
  it("marks the ADR as pending sign-off when the gate is not yet acknowledged", () => {
    const content = buildADRContent(useCase, recommendation, gate, 1);
    expect(content).toContain("**Status:** Pending governance sign-off");
    expect(content).toContain("**Acknowledged:** No - blocking");
  });

  it("marks the ADR as approved once the gate is acknowledged", () => {
    const content = buildADRContent(useCase, recommendation, { ...gate, acknowledged: true }, 1);
    expect(content).toContain("**Status:** Approved");
    expect(content).toContain("Yes - all required items confirmed");
  });

  it("surfaces a pending ARB line when ARB approval is required but not yet given", () => {
    const content = buildADRContent(
      useCase,
      recommendation,
      { ...gate, acknowledged: true, requiresArbApproval: true, arbApproved: false },
      1
    );
    expect(content).toContain("Architecture Review Board sign-off:** Pending - blocking");
  });

  it("names the approver once ARB has approved", () => {
    const content = buildADRContent(
      useCase,
      recommendation,
      {
        ...gate,
        acknowledged: true,
        requiresArbApproval: true,
        arbApproved: true,
        arbApprovedBy: "Reviewer Name",
        arbApprovedAt: "2026-02-01T00:00:00.000Z",
      },
      1
    );
    expect(content).toContain("Approved by Reviewer Name on 2026-02-01T00:00:00.000Z");
  });

  it("omits the Risk & Compliance section entirely when no details were supplied", () => {
    const content = buildADRContent(useCase, recommendation, gate, 1, null);
    expect(content).not.toContain("## Risk & Compliance Profile");
  });

  it("includes the Risk & Compliance section when details are supplied", () => {
    const rcd: RiskComplianceDetails = {
      useCaseId: "uc-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      regulatoryFrameworks: ["POPIA"],
      dataResidency: "South Africa",
      dataSources: ["Internal systems"],
      sensitiveDataElements: "Customer account numbers",
      retentionInputsDays: 30,
      retentionOutputsDays: 90,
      retentionLogsDays: null,
      modelSourcing: "third-party-api",
      modelVendor: "OpenRouter",
      customerImpactDecision: false,
      humanOversightFrequency: "full-review",
      humanReviewSamplePercent: null,
      escalationOwner: "Escalation Person",
      explainabilityRequirement: "Plain-language rationale on request",
      biasFairnessTestingPlan: "Quarterly sample review",
      preProductionValidation: "Shadow mode for two weeks",
      expectedUsageVolume: "Hundreds per day",
      businessCriticality: "Non-critical",
      fallbackRollbackPlan: "Revert to manual triage",
      encryptedAtRestInTransit: true,
      agentWriteAccessProduction: false,
      securityReviewCompleted: true,
      accountableOwner: "Accountable Person",
      usersToldAboutAi: true,
    };

    const content = buildADRContent(useCase, recommendation, gate, 1, rcd);
    expect(content).toContain("## Risk & Compliance Profile");
    expect(content).toContain("POPIA");
    expect(content).toContain("inputs 30d / outputs 90d / logs not specified");
    expect(content).toContain("Third-party API");
  });
});
