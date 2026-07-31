import { auth } from "@/auth";
import { startExecutionRun, StartExecutionInput } from "@/lib/executionPersistence";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;

  let body: StartExecutionInput;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await startExecutionRun(id, body);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ execution: result.execution });
}
