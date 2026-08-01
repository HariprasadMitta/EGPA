-- CreateTable
CREATE TABLE "RiskComplianceDetails" (
    "useCaseId" TEXT NOT NULL,
    "regulatoryFrameworks" TEXT[],
    "dataResidency" TEXT NOT NULL,
    "dataSources" TEXT[],
    "sensitiveDataElements" TEXT NOT NULL,
    "retentionInputsDays" INTEGER,
    "retentionOutputsDays" INTEGER,
    "retentionLogsDays" INTEGER,
    "modelSourcing" TEXT NOT NULL,
    "modelVendor" TEXT NOT NULL,
    "customerImpactDecision" BOOLEAN NOT NULL,
    "humanOversightFrequency" TEXT NOT NULL,
    "humanReviewSamplePercent" INTEGER,
    "escalationOwner" TEXT NOT NULL,
    "explainabilityRequirement" TEXT NOT NULL,
    "biasFairnessTestingPlan" TEXT NOT NULL,
    "preProductionValidation" TEXT NOT NULL,
    "expectedUsageVolume" TEXT NOT NULL,
    "businessCriticality" TEXT NOT NULL,
    "fallbackRollbackPlan" TEXT NOT NULL,
    "encryptedAtRestInTransit" BOOLEAN NOT NULL DEFAULT false,
    "agentWriteAccessProduction" BOOLEAN NOT NULL DEFAULT false,
    "securityReviewCompleted" BOOLEAN NOT NULL DEFAULT false,
    "accountableOwner" TEXT NOT NULL,
    "usersToldAboutAi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskComplianceDetails_pkey" PRIMARY KEY ("useCaseId")
);

-- AddForeignKey
ALTER TABLE "RiskComplianceDetails" ADD CONSTRAINT "RiskComplianceDetails_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "UseCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
