import { prisma } from "@/lib/prisma";
import { logAuditEntry } from "@/lib/audit";
import { sendNotification } from "@/lib/notifications";

export interface ReconciledReport {
  id: string;
  source: string;
  toolsUsed: string[];
  modelUsed: string | null;
  reportedAt: string;
  undeclaredTools: string[];
}

// Real reconciliation: compares what an external system reported actually
// using against this use case's declared, approved tool stack
// (Recommendation.tools). Model/vendor is shown side-by-side, not scored
// pass/fail - RiskComplianceDetails.modelVendor is free-text due-diligence
// documentation, not a strict declared value, and this app's own multi-
// provider fallback chain means "the model changed" is sometimes expected
// behavior, not a violation. Tool-set membership is unambiguous; model
// identity is not, so only tools get a real verdict.
export async function reconcileExternalReport(
  useCaseId: string,
  input: { toolsUsed: string[]; modelUsed?: string | null }
): Promise<{ reportId: string; undeclaredTools: string[] }> {
  const useCase = await prisma.useCase.findUnique({
    where: { id: useCaseId },
    include: { recommendation: true },
  });
  if (!useCase) throw new Error("Use case not found.");

  const declaredTools = new Set(useCase.recommendation?.tools ?? []);
  const undeclaredTools = input.toolsUsed.filter((t) => !declaredTools.has(t));

  const report = await prisma.actualUsageReport.create({
    data: {
      useCaseId,
      source: "external-api",
      toolsUsed: input.toolsUsed,
      modelUsed: input.modelUsed ?? null,
    },
  });

  if (undeclaredTools.length > 0) {
    await logAuditEntry({
      useCaseId,
      actorName: "External system (API report)",
      action: "undeclared_tool_detected",
      detail: `Reported tools outside declared stack: ${undeclaredTools.join(", ")}`,
    });
    await sendNotification({
      kind: "undeclared_tool_detected",
      useCaseTitle: useCase.title,
      useCaseId,
      tools: undeclaredTools,
    });
  }

  return { reportId: report.id, undeclaredTools };
}

export async function getReconciliationView(useCaseId: string) {
  const useCase = await prisma.useCase.findUnique({
    where: { id: useCaseId },
    include: {
      recommendation: true,
      riskComplianceDetails: true,
      actualUsageReports: { orderBy: { reportedAt: "desc" } },
      executions: { where: { dryRun: false } },
    },
  });
  if (!useCase) return null;

  const declaredTools = useCase.recommendation?.tools ?? [];
  const declaredModelVendor = useCase.riskComplianceDetails?.modelVendor ?? null;
  const declaredToolSet = new Set(declaredTools);

  const externalReports: ReconciledReport[] = useCase.actualUsageReports.map((r) => ({
    id: r.id,
    source: r.source,
    toolsUsed: r.toolsUsed,
    modelUsed: r.modelUsed,
    reportedAt: r.reportedAt.toISOString(),
    undeclaredTools: r.toolsUsed.filter((t) => !declaredToolSet.has(t)),
  }));

  return {
    declaredTools,
    declaredModelVendor,
    internalExecutionCount: useCase.executions.length,
    externalReports,
    totalUndeclaredToolIncidents: externalReports.reduce((sum, r) => sum + r.undeclaredTools.length, 0),
  };
}
