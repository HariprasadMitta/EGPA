import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { applyStepPatch, StepPatch } from "@/lib/executionPersistence";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; executionId: string; stepId: string }> }
) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id: useCaseId, executionId, stepId } = await params;

  const useCase = await prisma.useCase.findUnique({ where: { id: useCaseId } });
  if (!useCase) return Response.json({ error: "Use case not found." }, { status: 404 });
  if (useCase.killSwitchEngaged) {
    return Response.json(
      { error: "Kill switch is engaged for this use case - execution is blocked." },
      { status: 403 }
    );
  }

  let body: StepPatch;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const execution = await applyStepPatch(useCaseId, executionId, stepId, body);

  return Response.json({ execution });
}
