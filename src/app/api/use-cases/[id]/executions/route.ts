import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toExecutionRun } from "@/lib/dbMapping";
import { broadcastBundle } from "@/lib/broadcastBundle";

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
  const useCase = await prisma.useCase.findUnique({
    where: { id },
    include: { gate: true, recommendation: true },
  });
  if (!useCase) return Response.json({ error: "Use case not found." }, { status: 404 });

  if (useCase.killSwitchEngaged) {
    return Response.json(
      { error: "Kill switch is engaged for this use case - execution is blocked." },
      { status: 403 }
    );
  }

  const gate = useCase.gate;
  const gateEligible = Boolean(gate?.acknowledged) && (!gate?.requiresArbApproval || gate?.arbApproved);
  if (!gateEligible) {
    return Response.json(
      { error: "Governance gate is not cleared - execution requires an acknowledged (and ARB-approved, if required) gate." },
      { status: 403 }
    );
  }

  let body: StartExecutionBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const allowedTools = new Set(useCase.recommendation?.tools ?? []);
  const disallowed = body.steps.filter((s) => !allowedTools.has(s.tool));
  if (disallowed.length > 0) {
    return Response.json(
      {
        error: `Tool allowlist enforcement: step(s) referenced a tool outside the recommendation's approved tool stack: ${disallowed.map((s) => s.tool).join(", ")}`,
      },
      { status: 400 }
    );
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
    include: { steps: true, toolCallLogs: true },
  });

  await broadcastBundle(id);

  return Response.json({ execution: toExecutionRun(created) });
}
