export type RiskTier = "Low" | "Medium" | "High" | "Critical";

export type HitlTier = "none" | "advisory" | "approval-required" | "manual";

export type DataSensitivity =
  | "public"
  | "internal"
  | "confidential"
  | "regulated";

export type AutonomyLevel =
  | "suggest-only"
  | "human-approves-each-action"
  | "human-approves-batches"
  | "fully-autonomous";

export type IntegrationSurface =
  | "read-only-internal"
  | "read-write-internal"
  | "external-customer-facing"
  | "external-financial-or-safety";

export type ExpectedUsers = "team" | "department" | "org-wide" | "external-public";

export type HumanOversightFrequency = "full-review" | "sampled" | "exception-only";

export type ModelSourcing = "third-party-api" | "in-house-fine-tuned";

export type UseCaseStatus =
  | "draft"
  | "submitted"
  | "recommended"
  | "gated"
  | "approved"
  | "executing"
  | "executed"
  | "rejected";

export interface UseCase {
  id: string;
  title: string;
  description: string;
  businessDomain: string;
  dataSensitivity: DataSensitivity;
  autonomyLevel: AutonomyLevel;
  integrationSurface: IntegrationSurface;
  expectedUsers: ExpectedUsers;
  owner: string;
  steward: string;
  riskTier: RiskTier;
  status: UseCaseStatus;
  createdAt: string;
  killSwitchEngaged: boolean;
  ownerUserId: string;
}

export interface Recommendation {
  useCaseId: string;
  framework: string;
  tools: string[];
  harnessPattern: string;
  loopPattern: string;
  iterationCeiling: number;
  contextStrategy: string;
  rationale: string;
  alternativesConsidered: string | null;
  createdAt: string;
  version: number;
}

export interface GovernanceTemplate {
  riskTier: RiskTier;
  requiredApprovals: string[];
  requiredControls: string[];
  hitlTier: HitlTier;
  recertificationDays: number | null;
  version: number;
  supersedes: number | null;
  requiresArbApproval: boolean;
}

export interface GovernanceGate {
  useCaseId: string;
  riskTier: RiskTier;
  requiredControls: string[];
  hitlTier: HitlTier;
  acknowledged: boolean;
  acknowledgedItems: string[];
  acknowledgedAt: string | null;
  requiresArbApproval: boolean;
  arbApproved: boolean;
  arbApprovedBy: string | null;
  arbApprovedAt: string | null;
  arbApprovalReasoning: string | null;
}

export interface AuditLogEntry {
  id: string;
  useCaseId: string;
  actorName: string;
  action: string;
  detail: string | null;
  createdAt: string;
}

export interface Comment {
  id: string;
  useCaseId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ADR {
  useCaseId: string;
  version: number;
  createdAt: string;
  content: string;
}

export interface RiskComplianceDetails {
  useCaseId: string;
  regulatoryFrameworks: string[];
  dataResidency: string;
  dataSources: string[];
  sensitiveDataElements: string;
  retentionInputsDays: number | null;
  retentionOutputsDays: number | null;
  retentionLogsDays: number | null;
  modelSourcing: ModelSourcing;
  modelVendor: string;
  customerImpactDecision: boolean;
  humanOversightFrequency: HumanOversightFrequency;
  humanReviewSamplePercent: number | null;
  escalationOwner: string;
  explainabilityRequirement: string;
  biasFairnessTestingPlan: string;
  preProductionValidation: string;
  expectedUsageVolume: string;
  businessCriticality: string;
  fallbackRollbackPlan: string;
  encryptedAtRestInTransit: boolean;
  agentWriteAccessProduction: boolean;
  securityReviewCompleted: boolean;
  accountableOwner: string;
  usersToldAboutAi: boolean;
  createdAt: string;
}

export type ModelStatus = "approved" | "deprecated" | "under-review";

export interface MCPServerEntry {
  id: string;
  name: string;
  publisher: string;
  description: string;
  status: ModelStatus;
  allowedRiskTiers: RiskTier[];
}

export interface ModelRegistryEntry {
  id: string;
  name: string;
  vendor: string;
  version: string;
  status: ModelStatus;
  allowedRiskTiers: RiskTier[];
  changeReason: string | null;
}

export interface WebhookTriggerInfo {
  enabled: boolean;
  lastTriggeredAt: string | null;
  triggerCount: number;
}

export interface UseCaseBundle {
  useCase: UseCase;
  recommendation: Recommendation | null;
  gate: GovernanceGate | null;
  adr: ADR | null;
  executions: ExecutionRun[];
  webhookTrigger: WebhookTriggerInfo | null;
  riskComplianceDetails: RiskComplianceDetails | null;
}

export type UserRole = "requester" | "steward" | "governance-owner" | "developer" | "arb" | "admin";

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
}

export type SubAgentStepStatus = "pending" | "running" | "done" | "error";

export interface SubAgentStep {
  id: string;
  name: string;
  tool: string;
  task: string;
  rationale: string | null;
  status: SubAgentStepStatus;
  output: string | null;
  provider: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  toolCallCount: number;
  confidenceScore: number | null;
  piiDetected: boolean;
  piiMatchCount: number;
}

export interface ExecutionRun {
  id: string;
  runNumber: number;
  useCaseId: string;
  masterAgentSummary: string;
  steps: SubAgentStep[];
  status: "planning" | "running" | "completed" | "failed";
  startedAt: string;
  completedAt: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  error: string | null;
  dryRun: boolean;
}

export interface PingResult {
  ok: boolean;
  latencyMs: number;
  checkedAt: string;
  message?: string;
}

export interface OpenRouterConnection {
  connected: boolean;
  apiKey: string | null;
  selectedModel: string | null;
}

export interface HuggingFaceConnection {
  connected: boolean;
  accessToken: string | null;
  username: string | null;
  selectedModel: string | null;
}

export interface RagChunk {
  id: string;
  text: string;
  embedding: number[];
  addedAt: string;
}

export interface MlOpsPings {
  openRouter: PingResult | null;
  huggingFace: PingResult | null;
}
