import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toExecutionRun } from "@/lib/dbMapping";

export const runtime = "nodejs";

interface StartExecutionBody {
  executionId: string;
  runNumber: number;
  masterAgentSummary: string;
  steps: { id: string; name: string; tool: string; task: string }[];
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const useCase = await prisma.useCase.findUnique({ where: { id } });
  if (!useCase) return Response.json({ error: "Use case not found." }, { status: 404 });

  let body: StartExecutionBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  await prisma.executionRun.create({
    data: {
      id: body.executionId,
      runNumber: body.runNumber,
      useCaseId: id,
      masterAgentSummary: body.masterAgentSummary,
      status: "running",
      steps: {
        create: body.steps.map((s) => ({
          stepId: s.id,
          name: s.name,
          tool: s.tool,
          task: s.task,
          status: "pending",
        })),
      },
    },
  });
  await prisma.useCase.update({ where: { id }, data: { status: "executing" } });

  const created = await prisma.executionRun.findUniqueOrThrow({
    where: { id: body.executionId },
    include: { steps: true },
  });

  return Response.json({ execution: toExecutionRun(created) });
}
