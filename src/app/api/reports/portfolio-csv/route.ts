import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { USE_CASE_INCLUDE } from "@/lib/dbMapping";

export const runtime = "nodejs";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// Real compliance export - a CSV of every real use case's governance state,
// for an audit committee or a governance owner's own records, not just a
// live in-app dashboard. Same shared visibility as Portfolio - every
// signed-in user can pull the same real report.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const useCases = await prisma.useCase.findMany({
    include: USE_CASE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Title",
    "Business Domain",
    "Owner",
    "Steward",
    "Risk Tier",
    "Status",
    "Gate Acknowledged",
    "ARB Required",
    "ARB Approved",
    "Kill Switch Engaged",
    "Total Executions",
    "Total Real Cost USD",
    "Created At",
  ];

  const rows = useCases.map((uc) => {
    const totalCost = uc.executions.reduce((sum, e) => sum + e.totalCostUsd, 0);
    return [
      uc.title,
      uc.businessDomain,
      uc.owner,
      uc.steward,
      uc.riskTier,
      uc.status,
      uc.gate?.acknowledged ? "Yes" : "No",
      uc.gate?.requiresArbApproval ? "Yes" : "No",
      uc.gate?.arbApproved ? "Yes" : "No",
      uc.killSwitchEngaged ? "Yes" : "No",
      String(uc.executions.length),
      totalCost.toFixed(4),
      uc.createdAt.toISOString(),
    ].map((v) => csvEscape(String(v)));
  });

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv",
      "content-disposition": `attachment; filename="egpa-portfolio-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
