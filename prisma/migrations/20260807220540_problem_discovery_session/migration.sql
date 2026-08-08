-- CreateTable
CREATE TABLE "ProblemDiscoverySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "messages" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "recommendedPath" TEXT,
    "pathRationale" TEXT,
    "handedOffUseCaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemDiscoverySession_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProblemDiscoverySession" ADD CONSTRAINT "ProblemDiscoverySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
