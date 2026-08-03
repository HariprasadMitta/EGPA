import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { prisma } from "@/lib/prisma";
import { checkPolicyAllowed } from "@/lib/policyCheck";
import { logAuditEntry } from "@/lib/audit";

export const runtime = "nodejs";

interface PreflightBody {
  tool?: string;
  task?: string;
}

// Real-time circuit breaker, not just after-the-fact detection: an external
// production agent calls this before acting, and gets a real yes/no against
// the same rules this platform enforces on its own execution engine (see
// src/lib/policyCheck.ts) - kill switch, governance gate clearance, the
// declared tool allowlist, and the data-sensitivity write-action
// restriction. A denial is logged as a real audit entry; an allow is not
// (every real check would otherwise spam the audit trail for no benefit).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;

  let body: PreflightBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.tool) return Response.json({ error: "tool is required." }, { status: 400 });

  const useCase = await prisma.useCase.findUnique({
    where: { id },
    include: { gate: true, recommendation: true, riskComplianceDetails: true },
  });
  if (!useCase) return Response.json({ error: "Use case not found." }, { status: 404 });

  const result = checkPolicyAllowed(
    {
      killSwitchEngaged: useCase.killSwitchEngaged,
      gate: useCase.gate,
      declaredTools: useCase.recommendation?.tools ?? [],
      agentWriteAccessProduction: useCase.riskComplianceDetails?.agentWriteAccessProduction ?? null,
    },
    { tool: body.tool, task: body.task }
  );

  if (!result.allowed) {
    await logAuditEntry({
      useCaseId: id,
      actorName: "External system (preflight check)",
      action: "preflight_check_denied",
      detail: `Preflight check denied for tool "${body.tool}": ${result.reason}`,
    });
  }

  return Response.json(result);
}
