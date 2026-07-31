import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";
import { SAMPLE_BUNDLES } from "../src/lib/seed";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Placeholder credentials for the seed/demo account - real signup with a
  // user-chosen password lands in Phase 2 (real auth). This row only exists
  // so seeded UseCases have something to point ownerUserId at.
  const passwordHash = await bcrypt.hash("demo-seed-account-not-a-real-login", 10);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@momentum.local" },
    update: {},
    create: {
      email: "demo@momentum.local",
      passwordHash,
      name: "Demo Seed Account",
      role: "admin",
    },
  });

  for (const bundle of SAMPLE_BUNDLES) {
    const { useCase, recommendation, gate, adr } = bundle;

    await prisma.useCase.upsert({
      where: { id: useCase.id },
      update: {},
      create: {
        id: useCase.id,
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
        ownerUserId: demoUser.id,
      },
    });

    if (recommendation) {
      await prisma.recommendation.upsert({
        where: { useCaseId: useCase.id },
        update: {},
        create: {
          useCaseId: useCase.id,
          framework: recommendation.framework,
          tools: recommendation.tools,
          harnessPattern: recommendation.harnessPattern,
          loopPattern: recommendation.loopPattern,
          iterationCeiling: recommendation.iterationCeiling,
          contextStrategy: recommendation.contextStrategy,
          rationale: recommendation.rationale,
          createdAt: new Date(recommendation.createdAt),
          version: recommendation.version,
        },
      });
    }

    if (gate) {
      await prisma.governanceGate.upsert({
        where: { useCaseId: useCase.id },
        update: {},
        create: {
          useCaseId: useCase.id,
          riskTier: gate.riskTier,
          requiredControls: gate.requiredControls,
          hitlTier: gate.hitlTier,
          acknowledged: gate.acknowledged,
          acknowledgedItems: gate.acknowledgedItems,
          requiresArbApproval: gate.requiresArbApproval,
          arbApproved: gate.arbApproved,
          arbApprovedBy: gate.arbApprovedBy,
          arbApprovedAt: gate.arbApprovedAt ? new Date(gate.arbApprovedAt) : null,
        },
      });
    }

    if (adr) {
      await prisma.adr.upsert({
        where: { useCaseId_version: { useCaseId: useCase.id, version: adr.version } },
        update: {},
        create: {
          useCaseId: useCase.id,
          version: adr.version,
          createdAt: new Date(adr.createdAt),
          content: adr.content,
        },
      });
    }
  }

  console.log(`Seeded ${SAMPLE_BUNDLES.length} use cases under ${demoUser.email}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
