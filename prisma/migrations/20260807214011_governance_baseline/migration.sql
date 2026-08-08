-- CreateTable
CREATE TABLE "GovernanceBaseline" (
    "riskTier" TEXT NOT NULL,
    "baselineHours" DOUBLE PRECISION NOT NULL,
    "costPerHourUsd" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByName" TEXT,

    CONSTRAINT "GovernanceBaseline_pkey" PRIMARY KEY ("riskTier")
);
