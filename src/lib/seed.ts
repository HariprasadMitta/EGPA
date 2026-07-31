import { GOVERNANCE_TEMPLATES, classifyRisk } from "@/lib/governance";
import { ADR, GovernanceGate, Recommendation, UseCase, UseCaseBundle } from "@/types";
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
}): UseCaseBundle {
  const riskTier = classifyRisk({
    dataSensitivity: params.dataSensitivity,
    autonomyLevel: params.autonomyLevel,
    integrationSurface: params.integrationSurface,
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
    createdAt: params.createdAt,
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
    requiresArbApproval: template.requiresArbApproval,
    arbApproved: params.acknowledged,
    arbApprovedBy:
      params.acknowledged && template.requiresArbApproval ? "Pre-approved (seed data)" : null,
    arbApprovedAt: params.acknowledged && template.requiresArbApproval ? params.createdAt : null,
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
        content: buildADRContent(useCase, recommendation, gate, 1),
      }
    : null;

  return { useCase, recommendation, gate, adr, executions: [] };
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
    },
  }),
];
