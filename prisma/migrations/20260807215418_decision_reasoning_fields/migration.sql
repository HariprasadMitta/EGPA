-- AlterTable
ALTER TABLE "GovernanceGate" ADD COLUMN     "arbApprovalReasoning" TEXT;

-- AlterTable
ALTER TABLE "ModelRegistryEntry" ADD COLUMN     "changeReason" TEXT;

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "alternativesConsidered" TEXT;
