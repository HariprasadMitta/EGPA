import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Real governance action history for one use case - who engaged the kill
// switch, who (un)acknowledged which control, who finalized the gate, who
// approved as ARB, plus real system-detected drift/anomaly entries.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const entries = await prisma.auditLogEntry.findMany({
    where: { useCaseId: id },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({
    entries: entries.map((e) => ({
      id: e.id,
      useCaseId: e.useCaseId,
      actorName: e.actorName,
      action: e.action,
      detail: e.detail,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
