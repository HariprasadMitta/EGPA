import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { USE_CASE_INCLUDE } from "@/lib/dbMapping";
import { computeTimeSaved, formatHours } from "@/lib/timeSaved";
import { getReconciliationView } from "@/lib/reconciliation";

export const runtime = "nodejs";

// Real one-click audit evidence package - today this evidence is scattered
// across four different pages (ADR, gate, audit log, execution history);
// this bundles the same real records into one document an internal or
// third-party auditor can be handed directly, instead of asking them to
// click through the app themselves.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const useCase = await prisma.useCase.findUnique({ where: { id }, include: USE_CASE_INCLUDE });
  if (!useCase) return Response.json({ error: "Use case not found." }, { status: 404 });

  const auditLog = await prisma.auditLogEntry.findMany({
    where: { useCaseId: id },
    orderBy: { createdAt: "asc" },
  });

  const latestAdr = [...useCase.adrs].sort((a, b) => b.version - a.version)[0] ?? null;

  const baseline = await prisma.governanceBaseline.findUnique({ where: { riskTier: useCase.riskTier } });
  const timeSaved = computeTimeSaved({
    createdAt: useCase.createdAt,
    acknowledgedAt: useCase.gate?.acknowledgedAt ?? null,
    baselineHours: baseline?.baselineHours ?? null,
    costPerHourUsd: baseline?.costPerHourUsd ?? null,
  });

  const reconciliation = await getReconciliationView(id);

  const lines: string[] = [];
  lines.push(`# Audit Evidence Package: ${useCase.title}`);
  lines.push("");
  lines.push(`Generated ${new Date().toISOString()} by ${session.user.name} (${session.user.role}).`);
  lines.push("");
  lines.push("This package bundles the real ADR, governance gate state, full governance action");
  lines.push("audit trail, and execution history for one use case - every fact below is read");
  lines.push("directly from the platform's own records at the time of export, not summarized.");
  lines.push("");
  lines.push("---");
  lines.push("");

  lines.push("## 1. Latest Architecture Decision Record");
  lines.push("");
  if (latestAdr) {
    lines.push(latestAdr.content);
  } else {
    lines.push("_No ADR has been generated for this use case yet - governance gate not yet cleared._");
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  lines.push("## 2. Governance Action Audit Trail");
  lines.push("");
  if (auditLog.length === 0) {
    lines.push("_No governance actions recorded yet._");
  } else {
    lines.push("| Timestamp | Actor | Action | Detail |");
    lines.push("|---|---|---|---|");
    for (const entry of auditLog) {
      const detail = (entry.detail ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      lines.push(`| ${entry.createdAt.toISOString()} | ${entry.actorName} | ${entry.action} | ${detail} |`);
    }
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  lines.push("## 3. Execution History Summary");
  lines.push("");
  if (useCase.executions.length === 0) {
    lines.push("_No executions recorded yet._");
  } else {
    lines.push("| Run # | Status | Dry Run | Started | Steps | Total Cost USD | PII Redactions |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const run of [...useCase.executions].sort((a, b) => a.runNumber - b.runNumber)) {
      const piiCount = run.steps.filter((s) => s.piiDetected).length;
      lines.push(
        `| ${run.runNumber} | ${run.status} | ${run.dryRun ? "Yes" : "No"} | ${run.startedAt.toISOString()} | ${run.steps.length} | ${run.totalCostUsd.toFixed(4)} | ${piiCount} |`
      );
    }
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  lines.push("## 4. Time Saved");
  lines.push("");
  if (!timeSaved) {
    lines.push(
      "_Not available - either the governance gate hasn't cleared yet, or no admin-declared baseline is set for this risk tier (Admin -> Governance baseline)._"
    );
  } else {
    lines.push(`- Baseline (declared, ${useCase.riskTier} tier): ${formatHours(timeSaved.baselineHours)}`);
    lines.push(`- Actual (Intake submission to Gate clearing): ${formatHours(timeSaved.actualHours)}`);
    lines.push(`- Time saved: ${formatHours(timeSaved.hoursSaved)} (${timeSaved.percentFaster.toFixed(0)}% faster than baseline)`);
    if (timeSaved.costSavedUsd != null) {
      lines.push(`- Cost saved: $${timeSaved.costSavedUsd.toFixed(2)} (at the admin-declared cost/hour for this tier)`);
    }
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  lines.push("## 5. Declared vs. Actual Reconciliation Summary");
  lines.push("");
  if (!reconciliation) {
    lines.push("_Not available._");
  } else {
    lines.push(`- Declared tools: ${reconciliation.declaredTools.length > 0 ? reconciliation.declaredTools.join(", ") : "_none declared_"}`);
    lines.push(`- Declared model vendor: ${reconciliation.declaredModelVendor ?? "_not captured_"}`);
    lines.push(`- Internal executions run through this platform's own engine: ${reconciliation.internalExecutionCount} (preventively guaranteed to match the declared stack)`);
    lines.push(`- External usage reports received: ${reconciliation.externalReports.length}`);
    lines.push(`- Total undeclared-tool incidents across external reports: ${reconciliation.totalUndeclaredToolIncidents}`);
    if (reconciliation.externalReports.length > 0) {
      lines.push("");
      lines.push("| Reported At | Source | Tools Used | Model Used | Undeclared Tools |");
      lines.push("|---|---|---|---|---|");
      for (const r of reconciliation.externalReports) {
        lines.push(
          `| ${r.reportedAt} | ${r.source} | ${r.toolsUsed.join(", ") || "-"} | ${r.modelUsed ?? "-"} | ${r.undeclaredTools.join(", ") || "-"} |`
        );
      }
    }
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    `## 6. Current Kill-Switch State: ${useCase.killSwitchEngaged ? "ENGAGED" : "Disengaged"}`
  );
  lines.push("");
  lines.push("*End of evidence package.*");

  const doc = lines.join("\n");
  const safeTitle = useCase.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  return new Response(doc, {
    headers: {
      "content-type": "text/markdown",
      "content-disposition": `attachment; filename="evidence-${safeTitle}-${new Date().toISOString().slice(0, 10)}.md"`,
    },
  });
}
