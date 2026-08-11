import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";
import { SAMPLE_BUNDLES } from "../src/lib/seed";
import { MODEL_REGISTRY, MCP_SERVERS } from "../src/lib/modelRegistry";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Placeholder credentials for the seed/demo account - real signup with a
  // user-chosen password lands in Phase 2 (real auth). This row only exists
  // so seeded UseCases have something to point ownerUserId at.
  const passwordHash = await bcrypt.hash("demo-seed-account-not-a-real-login", 10);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@egpa.local" },
    update: {},
    create: {
      email: "demo@egpa.local",
      passwordHash,
      name: "Demo Seed Account",
      role: "admin",
    },
  });

  for (const bundle of SAMPLE_BUNDLES) {
    const { useCase, recommendation, gate, adr, riskComplianceDetails, executions } = bundle;

    const useCaseFields = {
      title: useCase.title,
      description: useCase.description,
      businessDomain: useCase.businessDomain,
      dataSensitivity: useCase.dataSensitivity,
      autonomyLevel: useCase.autonomyLevel,
      integrationSurface: useCase.integrationSurface,
      expectedUsers: useCase.expectedUsers,
      owner: useCase.owner,
      steward: useCase.steward,
      riskTier: useCase.riskTier,
      status: useCase.status,
      createdAt: new Date(useCase.createdAt),
    };
    await prisma.useCase.upsert({
      where: { id: useCase.id },
      // Real update on conflict, not a no-op - sample bundles are re-edited
      // in src/lib/seed.ts as the app evolves (new risk tiers, statuses,
      // execution history), and re-running this seed against a DB that
      // already has these rows from an earlier run needs to actually sync
      // them, not silently keep whatever was seeded the first time.
      update: useCaseFields,
      create: { id: useCase.id, ...useCaseFields, ownerUserId: demoUser.id },
    });

    if (recommendation) {
      const recommendationFields = {
        framework: recommendation.framework,
        tools: recommendation.tools,
        harnessPattern: recommendation.harnessPattern,
        loopPattern: recommendation.loopPattern,
        iterationCeiling: recommendation.iterationCeiling,
        contextStrategy: recommendation.contextStrategy,
        rationale: recommendation.rationale,
        alternativesConsidered: recommendation.alternativesConsidered,
        createdAt: new Date(recommendation.createdAt),
        version: recommendation.version,
      };
      await prisma.recommendation.upsert({
        where: { useCaseId: useCase.id },
        update: recommendationFields,
        create: { useCaseId: useCase.id, ...recommendationFields },
      });
    }

    if (gate) {
      const gateFields = {
        riskTier: gate.riskTier,
        requiredControls: gate.requiredControls,
        hitlTier: gate.hitlTier,
        acknowledged: gate.acknowledged,
        acknowledgedItems: gate.acknowledgedItems,
        acknowledgedAt: gate.acknowledgedAt ? new Date(gate.acknowledgedAt) : null,
        requiresArbApproval: gate.requiresArbApproval,
        arbApproved: gate.arbApproved,
        arbApprovedBy: gate.arbApprovedBy,
        arbApprovedAt: gate.arbApprovedAt ? new Date(gate.arbApprovedAt) : null,
        arbApprovalReasoning: gate.arbApprovalReasoning,
      };
      await prisma.governanceGate.upsert({
        where: { useCaseId: useCase.id },
        update: gateFields,
        create: { useCaseId: useCase.id, ...gateFields },
      });
    }

    if (adr) {
      const adrFields = { createdAt: new Date(adr.createdAt), content: adr.content };
      await prisma.adr.upsert({
        where: { useCaseId_version: { useCaseId: useCase.id, version: adr.version } },
        update: adrFields,
        create: { useCaseId: useCase.id, version: adr.version, ...adrFields },
      });
    }

    if (riskComplianceDetails) {
      const rcdFields = {
        regulatoryFrameworks: riskComplianceDetails.regulatoryFrameworks,
        dataResidency: riskComplianceDetails.dataResidency,
        dataSources: riskComplianceDetails.dataSources,
        sensitiveDataElements: riskComplianceDetails.sensitiveDataElements,
        retentionInputsDays: riskComplianceDetails.retentionInputsDays,
        retentionOutputsDays: riskComplianceDetails.retentionOutputsDays,
        retentionLogsDays: riskComplianceDetails.retentionLogsDays,
        modelSourcing: riskComplianceDetails.modelSourcing,
        modelVendor: riskComplianceDetails.modelVendor,
        customerImpactDecision: riskComplianceDetails.customerImpactDecision,
        humanOversightFrequency: riskComplianceDetails.humanOversightFrequency,
        humanReviewSamplePercent: riskComplianceDetails.humanReviewSamplePercent,
        escalationOwner: riskComplianceDetails.escalationOwner,
        explainabilityRequirement: riskComplianceDetails.explainabilityRequirement,
        biasFairnessTestingPlan: riskComplianceDetails.biasFairnessTestingPlan,
        preProductionValidation: riskComplianceDetails.preProductionValidation,
        expectedUsageVolume: riskComplianceDetails.expectedUsageVolume,
        businessCriticality: riskComplianceDetails.businessCriticality,
        fallbackRollbackPlan: riskComplianceDetails.fallbackRollbackPlan,
        encryptedAtRestInTransit: riskComplianceDetails.encryptedAtRestInTransit,
        agentWriteAccessProduction: riskComplianceDetails.agentWriteAccessProduction,
        securityReviewCompleted: riskComplianceDetails.securityReviewCompleted,
        accountableOwner: riskComplianceDetails.accountableOwner,
        usersToldAboutAi: riskComplianceDetails.usersToldAboutAi,
        createdAt: new Date(riskComplianceDetails.createdAt),
      };
      await prisma.riskComplianceDetails.upsert({
        where: { useCaseId: useCase.id },
        update: rcdFields,
        create: { useCaseId: useCase.id, ...rcdFields },
      });
    }

    // Real ExecutionRun + SubAgentStep rows for samples that declare
    // fabricated-but-plausible execution history (see sampleRun() in
    // src/lib/seed.ts) - upserted the same idempotent way as everything
    // else above, keyed on the deterministic run id so re-seeding doesn't
    // duplicate rows.
    for (const run of executions ?? []) {
      const runFields = {
        runNumber: run.runNumber,
        useCaseId: useCase.id,
        masterAgentSummary: run.masterAgentSummary,
        status: run.status,
        startedAt: new Date(run.startedAt),
        completedAt: run.completedAt ? new Date(run.completedAt) : null,
        totalInputTokens: run.totalInputTokens,
        totalOutputTokens: run.totalOutputTokens,
        totalCostUsd: run.totalCostUsd,
        error: run.error,
        dryRun: run.dryRun,
      };
      await prisma.executionRun.upsert({
        where: { id: run.id },
        update: runFields,
        create: { id: run.id, ...runFields },
      });

      for (const step of run.steps) {
        const stepFields = {
          name: step.name,
          tool: step.tool,
          task: step.task,
          rationale: step.rationale,
          status: step.status,
          output: step.output,
          provider: step.provider,
          inputTokens: step.inputTokens,
          outputTokens: step.outputTokens,
          costUsd: step.costUsd,
          durationMs: step.durationMs,
          confidenceScore: step.confidenceScore,
          piiDetected: step.piiDetected,
          piiMatchCount: step.piiMatchCount,
        };
        await prisma.subAgentStep.upsert({
          where: { executionRunId_stepId: { executionRunId: run.id, stepId: step.id } },
          update: stepFields,
          create: { stepId: step.id, executionRunId: run.id, ...stepFields },
        });
      }
    }
  }

  console.log(`Seeded ${SAMPLE_BUNDLES.length} use cases under ${demoUser.email}.`);

  // One-time backfill of the Model Registry from what used to be hardcoded
  // arrays (src/lib/modelRegistry.ts) into real DB rows - the registry is
  // now genuinely admin-manageable, this just seeds its starting state.
  for (const m of MODEL_REGISTRY) {
    await prisma.modelRegistryEntry.upsert({
      where: { id: m.id },
      update: {},
      create: { id: m.id, name: m.name, vendor: m.vendor, version: m.version, status: m.status, allowedRiskTiers: m.allowedRiskTiers, changeReason: m.changeReason },
    });
  }
  for (const s of MCP_SERVERS) {
    await prisma.mcpServerEntry.upsert({
      where: { id: s.id },
      update: {},
      create: { id: s.id, name: s.name, publisher: s.publisher, description: s.description, status: s.status, allowedRiskTiers: s.allowedRiskTiers },
    });
  }
  console.log(`Seeded ${MODEL_REGISTRY.length} model registry entries and ${MCP_SERVERS.length} MCP servers.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
