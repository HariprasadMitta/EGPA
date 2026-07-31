import type {
  Adr as DbAdr,
  ExecutionRun as DbExecutionRun,
  GovernanceGate as DbGovernanceGate,
  Recommendation as DbRecommendation,
  SubAgentStep as DbSubAgentStep,
  UseCase as DbUseCase,
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
} from "@/types";

type FullUseCase = DbUseCase & {
  recommendation: DbRecommendation | null;
  gate: DbGovernanceGate | null;
  adrs: DbAdr[];
  executions: (DbExecutionRun & { steps: DbSubAgentStep[] })[];
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

export function toSubAgentStep(row: DbSubAgentStep): SubAgentStep {
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
  };
}

export function toExecutionRun(row: DbExecutionRun & { steps: DbSubAgentStep[] }): ExecutionRun {
  const steps = [...row.steps].sort((a, b) => (a.stepId > b.stepId ? 1 : -1));
  return {
    id: row.id,
    runNumber: row.runNumber,
    useCaseId: row.useCaseId,
    masterAgentSummary: row.masterAgentSummary,
    steps: steps.map(toSubAgentStep),
    status: row.status as ExecutionRun["status"],
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    totalInputTokens: row.totalInputTokens,
    totalOutputTokens: row.totalOutputTokens,
    totalCostUsd: row.totalCostUsd,
    error: row.error,
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
  };
}

export const USE_CASE_INCLUDE = {
  recommendation: true,
  gate: true,
  adrs: true,
  executions: { include: { steps: true } },
} as const;
