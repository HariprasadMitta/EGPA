-- CreateTable
CREATE TABLE "ActualUsageReport" (
    "id" TEXT NOT NULL,
    "useCaseId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "toolsUsed" TEXT[],
    "modelUsed" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActualUsageReport_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ActualUsageReport" ADD CONSTRAINT "ActualUsageReport_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "UseCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
