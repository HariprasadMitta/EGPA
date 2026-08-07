import { GOVERNANCE_TEMPLATES, classifyRisk } from "@/lib/governance";
import { ADR, GovernanceGate, Recommendation, RiskComplianceDetails, UseCase, UseCaseBundle } from "@/types";
import { buildADRContent } from "@/lib/adr";

function makeBundle(params: {
  id: string;
  title: string;
  description: string;
  businessDomain: string;
  dataSensitivity: UseCase["dataSensitivity"];
  autonomyLevel: UseCase["autonomyLevel"];
  integrationSurface: UseCase["integrationSurface"];
  expectedUsers: UseCase["expectedUsers"];
  owner: string;
  steward: string;
  createdAt: string;
  recommendation: Omit<Recommendation, "useCaseId" | "createdAt" | "version">;
  acknowledged: boolean;
  riskComplianceDetails: Omit<RiskComplianceDetails, "useCaseId" | "createdAt">;
}): UseCaseBundle {
  const riskTier = classifyRisk({
    dataSensitivity: params.dataSensitivity,
    autonomyLevel: params.autonomyLevel,
    integrationSurface: params.integrationSurface,
    humanOversightFrequency: params.riskComplianceDetails.humanOversightFrequency,
    customerImpactDecision: params.riskComplianceDetails.customerImpactDecision,
  });
  const template = GOVERNANCE_TEMPLATES[riskTier];

  const useCase: UseCase = {
    id: params.id,
    title: params.title,
    description: params.description,
    businessDomain: params.businessDomain,
    dataSensitivity: params.dataSensitivity,
    autonomyLevel: params.autonomyLevel,
    integrationSurface: params.integrationSurface,
    expectedUsers: params.expectedUsers,
    owner: params.owner,
    steward: params.steward,
    riskTier,
    status: params.acknowledged ? "approved" : "gated",
    killSwitchEngaged: false,
    createdAt: params.createdAt,
    // Sample bundles are client-only display data, never a real DB row -
    // this sentinel just satisfies the type; no real account can match it,
    // so the segregation-of-duties check (which compares against a real
    // ownerUserId) never accidentally blocks a real ARB approval on samples.
    ownerUserId: "sample-seed-owner",
  };

  const recommendation: Recommendation = {
    ...params.recommendation,
    useCaseId: params.id,
    createdAt: params.createdAt,
    version: 1,
  };

  const gate: GovernanceGate = {
    useCaseId: params.id,
    riskTier,
    requiredControls: template.requiredControls,
    hitlTier: template.hitlTier,
    acknowledged: params.acknowledged,
    acknowledgedItems: params.acknowledged ? template.requiredControls : [],
    acknowledgedAt: params.acknowledged ? params.createdAt : null,
    requiresArbApproval: template.requiresArbApproval,
    arbApproved: params.acknowledged,
    arbApprovedBy:
      params.acknowledged && template.requiresArbApproval ? "Pre-approved (seed data)" : null,
    arbApprovedAt: params.acknowledged && template.requiresArbApproval ? params.createdAt : null,
    arbApprovalReasoning:
      params.acknowledged && template.requiresArbApproval
        ? "Pre-approved seed data - reasoning not applicable to a sample bundle."
        : null,
  };

  const riskComplianceDetails: RiskComplianceDetails = {
    ...params.riskComplianceDetails,
    useCaseId: params.id,
    createdAt: params.createdAt,
  };

  // Only bake an ADR for samples that already cleared their gate. An
  // unacknowledged sample must generate its ADR fresh once a visitor
  // actually completes the checklist, so it reflects that acknowledgment -
  // pre-baking one here would leave a stale "pending" ADR that the ADR
  // page's regenerate-if-missing guard would never refresh.
  const adr: ADR | null = params.acknowledged
    ? {
        useCaseId: params.id,
        version: 1,
        createdAt: params.createdAt,
        content: buildADRContent(useCase, recommendation, gate, 1, riskComplianceDetails),
      }
    : null;

  return { useCase, recommendation, gate, adr, executions: [], webhookTrigger: null, riskComplianceDetails };
}

export const SAMPLE_BUNDLES: UseCaseBundle[] = [
  makeBundle({
    id: "sample-complaint-triage",
    title: "Customer Complaint Triage Agent",
    description:
      "An agent that reads inbound customer complaints across email, chat, and a web form, classifies severity and department, drafts a suggested response, and routes the ticket to the right queue. Business unit: Retail Banking Customer Care.",
    businessDomain: "Retail Banking - Customer Care",
    dataSensitivity: "confidential",
    autonomyLevel: "human-approves-each-action",
    integrationSurface: "read-write-internal",
    expectedUsers: "department",
    owner: "Priya Nandakumar (Customer Care Ops Lead)",
    steward: "Marcus Chen (Solutions Architect)",
    createdAt: "2026-07-14T15:00:00.000Z",
    acknowledged: true,
    recommendation: {
      framework: "LangGraph",
      tools: [
        "Ticketing system API (read/write)",
        "PII redaction service",
        "Sentiment/severity classifier",
        "Response draft generator",
        "Queue routing API",
      ],
      harnessPattern: "Supervisor + worker sub-agents",
      loopPattern: "Plan-then-execute with per-response review checkpoint",
      iterationCeiling: 8,
      contextStrategy: "Sliding window with tool-result summarization",
      rationale:
        "Medium risk tier permits a supervised multi-step pipeline, but confidential customer data means each drafted response still needs a human check before it goes out. LangGraph's explicit state graph makes the classify -> draft -> route flow auditable, and a worker-per-channel pattern keeps the email/chat/form parsers isolated from the routing logic.",
      alternativesConsidered:
        "A single-agent ReAct loop was considered but rejected - one model juggling classification, drafting, and routing in one context makes the per-response human checkpoint harder to place cleanly. AutoGen's conversational multi-agent pattern was also considered but passed over: this workflow is a fixed pipeline, not an open-ended discussion, so LangGraph's explicit graph is a better fit than AutoGen's conversation-driven control flow.",
    },
    riskComplianceDetails: {
      regulatoryFrameworks: ["POPIA", "FSCA Conduct Standards"],
      dataResidency: "South Africa",
      dataSources: ["internal", "customer-submitted"],
      sensitiveDataElements: "Customer names, contact details, complaint free-text (may reference account numbers)",
      retentionInputsDays: 365,
      retentionOutputsDays: 365,
      retentionLogsDays: 730,
      modelSourcing: "third-party-api",
      modelVendor: "Anthropic (via the AI Gateway)",
      customerImpactDecision: false,
      humanOversightFrequency: "full-review",
      humanReviewSamplePercent: 100,
      escalationOwner: "Priya Nandakumar (Customer Care Ops Lead)",
      explainabilityRequirement: "Drafted response must cite the complaint text it responded to - no black-box scoring surfaced to the customer",
      biasFairnessTestingPlan: "Quarterly sample review for tone/severity-classification consistency across complaint channels",
      preProductionValidation: "100 historical complaints replayed against the draft-response step, checked against the actual outcome",
      expectedUsageVolume: "~400 complaints/week",
      businessCriticality: "Business-important - delays degrade customer care SLAs but no safety impact",
      fallbackRollbackPlan: "Revert to the manual triage queue - agent output is advisory until a human sends it",
      encryptedAtRestInTransit: true,
      agentWriteAccessProduction: true,
      securityReviewCompleted: true,
      accountableOwner: "Priya Nandakumar (Customer Care Ops Lead)",
      usersToldAboutAi: true,
    },
  }),
  makeBundle({
    id: "sample-network-ticket",
    title: "Network Ticket Classification Agent",
    description:
      "An agent that ingests raw network operations tickets from multiple regional business units, classifies fault type and priority, correlates with known outage patterns, and can automatically open a change ticket in the network management system for common, well-understood fault classes.",
    businessDomain: "Network Operations - Federated Business Units",
    dataSensitivity: "confidential",
    autonomyLevel: "fully-autonomous",
    integrationSurface: "external-financial-or-safety",
    expectedUsers: "org-wide",
    owner: "Diego Alves (NetOps Director)",
    steward: "Fatima Al-Sayed (Platform Architect)",
    createdAt: "2026-07-20T09:30:00.000Z",
    acknowledged: false,
    recommendation: {
      framework: "Custom orchestrator on the Claude Agent SDK",
      tools: [
        "Ticketing system API (read/write)",
        "Network Topology CMDB MCP Server",
        "Outage pattern correlation service",
        "Change management system (write, gated)",
        "Regional escalation directory",
      ],
      harnessPattern: "Single-agent with mandatory approval gate before write actions",
      loopPattern: "ReAct with reflection step before any change-ticket write",
      iterationCeiling: 4,
      contextStrategy: "Full context per ticket, no cross-ticket carryover",
      rationale:
        "The combination of fully-autonomous intent and a safety-adjacent blast radius (network changes across business units) computes to Critical, so the harness must hard-block autonomous writes behind a manual approval gate regardless of the model's own confidence. A tight iteration ceiling limits runaway correlation loops on ambiguous tickets.",
      alternativesConsidered:
        "A supervisor + worker sub-agent pattern (as used for complaint triage) was considered but rejected here - splitting correlation and change-ticket-writing across separate sub-agents would obscure exactly which step decided to write, weakening the auditability this Critical-tier use case needs. Fully autonomous writes with only post-hoc review were also considered and rejected outright - the safety-adjacent blast radius requires the approval gate to sit before the write, not after it.",
    },
    riskComplianceDetails: {
      regulatoryFrameworks: ["FSCA Conduct Standards", "SARB/Basel"],
      dataResidency: "South Africa, federated across regional business units",
      dataSources: ["internal"],
      sensitiveDataElements: "Network topology data, incident timestamps, regional infrastructure identifiers",
      retentionInputsDays: 180,
      retentionOutputsDays: 365,
      retentionLogsDays: 1095,
      modelSourcing: "third-party-api",
      modelVendor: "OpenRouter (via the AI Gateway, multi-provider fallback)",
      customerImpactDecision: true,
      humanOversightFrequency: "exception-only",
      humanReviewSamplePercent: null,
      escalationOwner: "Diego Alves (NetOps Director)",
      explainabilityRequirement: "Every auto-opened change ticket must cite the matched outage pattern and confidence score",
      biasFairnessTestingPlan: "Not yet completed - a blocking item before this use case can clear governance sign-off",
      preProductionValidation: "Not yet completed - a blocking item before this use case can clear governance sign-off",
      expectedUsageVolume: "~1,200 tickets/week across all regional business units",
      businessCriticality: "Safety-adjacent - an unreviewed autonomous network change can cause a wider outage",
      fallbackRollbackPlan: "Kill-switch halts the next execution step server-side; opened change tickets still require the existing change-management approval before taking effect",
      encryptedAtRestInTransit: true,
      agentWriteAccessProduction: true,
      securityReviewCompleted: false,
      accountableOwner: "Fatima Al-Sayed (Platform Architect)",
      usersToldAboutAi: false,
    },
  }),
  makeBundle({
    id: "sample-expense-anomaly",
    title: "Employee Expense Anomaly Detection Agent",
    description:
      "An agent that scans submitted expense reports, flags statistical anomalies against peer-group spending baselines, and produces a plain-language explanation for the finance reviewer. It never approves or rejects a report itself.",
    businessDomain: "Finance - Travel & Expense",
    dataSensitivity: "internal",
    autonomyLevel: "suggest-only",
    integrationSurface: "read-only-internal",
    expectedUsers: "team",
    owner: "Helen Osei (Finance Controller)",
    steward: "Ravi Deshmukh (Data Platform Engineer)",
    createdAt: "2026-07-24T13:45:00.000Z",
    acknowledged: true,
    recommendation: {
      framework: "AutoGen",
      tools: [
        "Expense system read API",
        "Peer-group baseline statistics service",
        "Anomaly scoring model",
        "Plain-language explanation generator",
      ],
      harnessPattern: "Single-agent with tool-calling loop",
      loopPattern: "Simple ReAct, no reflection needed",
      iterationCeiling: 12,
      contextStrategy: "Full context, no compaction needed",
      rationale:
        "Suggest-only autonomy against read-only internal data computes to Low risk, so a lightweight single-agent loop is appropriate. Because the agent never writes back to the expense system, iteration ceiling can be generous without materially increasing blast radius.",
      alternativesConsidered:
        "A supervisor + worker pattern was considered but rejected as unnecessary overhead - there's no write action to gate and no multi-channel input to isolate, so the added coordination cost wouldn't buy anything at Low risk. A stricter iteration ceiling was also considered but rejected: with no write access, a generous ceiling costs a few extra cents of compute at worst, not additional risk.",
    },
    riskComplianceDetails: {
      regulatoryFrameworks: [],
      dataResidency: "South Africa",
      dataSources: ["internal"],
      sensitiveDataElements: "Employee expense line items, merchant names, amounts - no card numbers or bank details",
      retentionInputsDays: 90,
      retentionOutputsDays: 90,
      retentionLogsDays: 365,
      modelSourcing: "third-party-api",
      modelVendor: "Groq (via the AI Gateway)",
      customerImpactDecision: false,
      humanOversightFrequency: "full-review",
      humanReviewSamplePercent: 100,
      escalationOwner: "Helen Osei (Finance Controller)",
      explainabilityRequirement: "Flag must state which peer-group baseline and which specific line items triggered it",
      biasFairnessTestingPlan: "Peer groups reviewed annually for size/composition bias",
      preProductionValidation: "Backtested against 6 months of historical expense data with known-anomaly labels",
      expectedUsageVolume: "~150 expense reports/week",
      businessCriticality: "Low - advisory only, the finance reviewer makes every real decision",
      fallbackRollbackPlan: "Disable the flag and revert to unassisted manual review - no dependency created",
      encryptedAtRestInTransit: true,
      agentWriteAccessProduction: false,
      securityReviewCompleted: true,
      accountableOwner: "Helen Osei (Finance Controller)",
      usersToldAboutAi: true,
    },
  }),
];
