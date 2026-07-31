-- AlterTable
ALTER TABLE "UseCase" ADD COLUMN     "killSwitchEngaged" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ToolCallLog" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "argsJson" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executionRunId" TEXT NOT NULL,

    CONSTRAINT "ToolCallLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ToolCallLog" ADD CONSTRAINT "ToolCallLog_executionRunId_fkey" FOREIGN KEY ("executionRunId") REFERENCES "ExecutionRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
