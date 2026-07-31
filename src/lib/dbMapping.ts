import type {
  Adr as DbAdr,
  ExecutionRun as DbExecutionRun,
  GovernanceGate as DbGovernanceGate,
  Recommendation as DbRecommendation,
  SubAgentStep as DbSubAgentStep,
  ToolCallLog as DbToolCallLog,
  UseCase as DbUseCase,
  WebhookTrigger as DbWebhookTrigger,
} from "@prisma/client";
import {
  ADR,
  AutonomyLevel,
  DataSensitivity,
  ExecutionRun,
  GovernanceGate,
  HitlTier,
  IntegrationSurface,
  Recommendation,
  RiskTier,
  SubAgentStep,
  SubAgentStepStatus,
  UseCase,
  UseCaseBundle,
  UseCaseStatus,
  WebhookTriggerInfo,
} from "@/types";

type FullUseCase = DbUseCase & {
  recommendation: DbRecommendation | null;
  gate: DbGovernanceGate | null;
  adrs: DbAdr[];
  executions: (DbExecutionRun & { steps: DbSubAgentStep[]; toolCallLogs: DbToolCallLog[] })[];
  webhookTrigger: DbWebhookTrigger | null;
};

export function toUseCase(row: DbUseCase): UseCase {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    businessDomain: row.businessDomain,
    dataSensitivity: row.dataSensitivity as DataSensitivity,
    autonomyLevel: row.autonomyLevel as AutonomyLevel,
    integrationSurface: row.integrationSurface as IntegrationSurface,
    expectedUsers: row.expectedUsers as UseCase["expectedUsers"],
    owner: row.owner,
    steward: row.steward,
    riskTier: row.riskTier as RiskTier,
    status: row.status as UseCaseStatus,
    createdAt: row.createdAt.toISOString(),
    killSwitchEngaged: row.killSwitchEngaged,
  };
}

export function toRecommendation(row: DbRecommendation): Recommendation {
  return {
    useCaseId: row.useCaseId,
    framework: row.framework,
    tools: row.tools,
    harnessPattern: row.harnessPattern,
    loopPattern: row.loopPattern,
    iterationCeiling: row.iterationCeiling,
    contextStrategy: row.contextStrategy,
    rationale: row.rationale,
    createdAt: row.createdAt.toISOString(),
    version: row.version,
  };
}

export function toGate(row: DbGovernanceGate): GovernanceGate {
  return {
    useCaseId: row.useCaseId,
    riskTier: row.riskTier as RiskTier,
    requiredControls: row.requiredControls,
    hitlTier: row.hitlTier as HitlTier,
    acknowledged: row.acknowledged,
    acknowledgedItems: row.acknowledgedItems,
    requiresArbApproval: row.requiresArbApproval,
    arbApproved: row.arbApproved,
    arbApprovedBy: row.arbApprovedBy,
    arbApprovedAt: row.arbApprovedAt ? row.arbApprovedAt.toISOString() : null,
  };
}

export function toAdr(row: DbAdr): ADR {
  return {
    useCaseId: row.useCaseId,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    content: row.content,
  };
}

export function latestAdr(adrs: DbAdr[]): ADR | null {
  if (adrs.length === 0) return null;
  const latest = [...adrs].sort((a, b) => b.version - a.version)[0];
  return toAdr(latest);
}

export function toSubAgentStep(row: DbSubAgentStep, toolCallCount = 0): SubAgentStep {
  return {
    id: row.stepId,
    name: row.name,
    tool: row.tool,
    task: row.task,
    status: row.status as SubAgentStepStatus,
    output: row.output,
    provider: row.provider,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    costUsd: row.costUsd,
    durationMs: row.durationMs,
    toolCallCount,
  };
}

export function toExecutionRun(
  row: DbExecutionRun & { steps: DbSubAgentStep[]; toolCallLogs: DbToolCallLog[] }
): ExecutionRun {
  const steps = [...row.steps].sort((a, b) => (a.stepId > b.stepId ? 1 : -1));
  const countsByStepId = row.toolCallLogs.reduce<Record<string, number>>((acc, log) => {
    acc[log.stepId] = (acc[log.stepId] ?? 0) + 1;
    return acc;
  }, {});
  return {
    id: row.id,
    runNumber: row.runNumber,
    useCaseId: row.useCaseId,
    masterAgentSummary: row.masterAgentSummary,
    steps: steps.map((s) => toSubAgentStep(s, countsByStepId[s.stepId] ?? 0)),
    status: row.status as ExecutionRun["status"],
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    totalInputTokens: row.totalInputTokens,
    totalOutputTokens: row.totalOutputTokens,
    totalCostUsd: row.totalCostUsd,
    error: row.error,
  };
}

export function toWebhookTriggerInfo(row: DbWebhookTrigger | null): WebhookTriggerInfo | null {
  if (!row) return null;
  return {
    enabled: row.enabled,
    lastTriggeredAt: row.lastTriggeredAt ? row.lastTriggeredAt.toISOString() : null,
    triggerCount: row.triggerCount,
  };
}

export function toUseCaseBundle(row: FullUseCase): UseCaseBundle {
  return {
    useCase: toUseCase(row),
    recommendation: row.recommendation ? toRecommendation(row.recommendation) : null,
    gate: row.gate ? toGate(row.gate) : null,
    adr: latestAdr(row.adrs),
    executions: [...row.executions]
      .sort((a, b) => a.runNumber - b.runNumber)
      .map(toExecutionRun),
    webhookTrigger: toWebhookTriggerInfo(row.webhookTrigger),
  };
}

export const USE_CASE_INCLUDE = {
  recommendation: true,
  gate: true,
  adrs: true,
  executions: { include: { steps: true, toolCallLogs: true } },
  webhookTrigger: true,
} as const;
