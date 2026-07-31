-- CreateTable
CREATE TABLE "WebhookTrigger" (
    "id" TEXT NOT NULL,
    "useCaseId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTriggeredAt" TIMESTAMP(3),
    "triggerCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WebhookTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookTrigger_useCaseId_key" ON "WebhookTrigger"("useCaseId");

-- AddForeignKey
ALTER TABLE "WebhookTrigger" ADD CONSTRAINT "WebhookTrigger_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "UseCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
