-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UseCase" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "businessDomain" TEXT NOT NULL,
    "dataSensitivity" TEXT NOT NULL,
    "autonomyLevel" TEXT NOT NULL,
    "integrationSurface" TEXT NOT NULL,
    "expectedUsers" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "steward" TEXT NOT NULL,
    "riskTier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerUserId" TEXT NOT NULL,

    CONSTRAINT "UseCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "useCaseId" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "tools" TEXT[],
    "harnessPattern" TEXT NOT NULL,
    "loopPattern" TEXT NOT NULL,
    "iterationCeiling" INTEGER NOT NULL,
    "contextStrategy" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("useCaseId")
);

-- CreateTable
CREATE TABLE "GovernanceGate" (
    "useCaseId" TEXT NOT NULL,
    "riskTier" TEXT NOT NULL,
    "requiredControls" TEXT[],
    "hitlTier" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedItems" TEXT[],
    "requiresArbApproval" BOOLEAN NOT NULL DEFAULT false,
    "arbApproved" BOOLEAN NOT NULL DEFAULT false,
    "arbApprovedBy" TEXT,
    "arbApprovedAt" TIMESTAMP(3),

    CONSTRAINT "GovernanceGate_pkey" PRIMARY KEY ("useCaseId")
);

-- CreateTable
CREATE TABLE "Adr" (
    "id" TEXT NOT NULL,
    "useCaseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT NOT NULL,

    CONSTRAINT "Adr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionRun" (
    "id" TEXT NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "useCaseId" TEXT NOT NULL,
    "masterAgentSummary" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalInputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalOutputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "ExecutionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubAgentStep" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "output" TEXT,
    "provider" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "executionRunId" TEXT NOT NULL,

    CONSTRAINT "SubAgentStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Adr_useCaseId_version_key" ON "Adr"("useCaseId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SubAgentStep_executionRunId_stepId_key" ON "SubAgentStep"("executionRunId", "stepId");

-- AddForeignKey
ALTER TABLE "UseCase" ADD CONSTRAINT "UseCase_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "UseCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceGate" ADD CONSTRAINT "GovernanceGate_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "UseCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adr" ADD CONSTRAINT "Adr_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "UseCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionRun" ADD CONSTRAINT "ExecutionRun_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "UseCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubAgentStep" ADD CONSTRAINT "SubAgentStep_executionRunId_fkey" FOREIGN KEY ("executionRunId") REFERENCES "ExecutionRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
