import { prisma } from "@/lib/prisma";
import { toUseCaseBundle, USE_CASE_INCLUDE } from "@/lib/dbMapping";
import { publishUseCaseUpdate } from "@/lib/eventBus";

// Re-fetches a use case's full bundle and publishes it to any subscribed
// SSE clients (src/app/api/use-cases/events/route.ts). Called by every
// mutation route right after its own write so other signed-in users watching
// the same use case see the change live, not just the caller who made it.
export async function broadcastBundle(useCaseId: string): Promise<void> {
  const row = await prisma.useCase.findUnique({
    where: { id: useCaseId },
    include: USE_CASE_INCLUDE,
  });
  if (!row) return;
  publishUseCaseUpdate({ useCaseId, bundle: toUseCaseBundle(row) });
}
