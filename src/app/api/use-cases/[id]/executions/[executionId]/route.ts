import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toExecutionRun } from "@/lib/dbMapping";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; executionId: string }> }
) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { executionId } = await params;

  let body: { error: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const updated = await prisma.executionRun.update({
    where: { id: executionId },
    data: { status: "failed", error: body.error, completedAt: new Date() },
    include: { steps: true },
  });

  return Response.json({ execution: toExecutionRun(updated) });
}
