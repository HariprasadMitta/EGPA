import { authenticateApiKey, requireWriteScope } from "@/lib/apiKeyAuth";
import { reconcileExternalReport } from "@/lib/reconciliation";

export const runtime = "nodejs";

interface ActualUsageBody {
  toolsUsed?: string[];
  modelUsed?: string;
}

// Real declared-vs-actual reconciliation entry point for an enterprise's
// own production agent - the one this platform has no preventive control
// over, unlike a use case run through this app's own execution engine
// (which already rejects an undeclared tool before it can run at all, see
// src/lib/executionPersistence.ts). An external system calls this after
// each real run to report what it actually used; a tool outside the
// declared, approved stack is flagged as a real audit finding, not
// silently accepted.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const write = requireWriteScope(auth.scope);
  if (!write.ok) return Response.json({ error: write.error }, { status: write.status });

  const { id } = await params;

  let body: ActualUsageBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!Array.isArray(body.toolsUsed)) {
    return Response.json({ error: "toolsUsed must be an array of tool name strings." }, { status: 400 });
  }

  try {
    const result = await reconcileExternalReport(id, { toolsUsed: body.toolsUsed, modelUsed: body.modelUsed });
    return Response.json({
      reportId: result.reportId,
      undeclaredTools: result.undeclaredTools,
      violation: result.undeclaredTools.length > 0,
    });
  } catch {
    return Response.json({ error: "Use case not found." }, { status: 404 });
  }
}
