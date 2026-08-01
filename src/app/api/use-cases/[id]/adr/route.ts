import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildADRContent } from "@/lib/adr";
import { toAdr, toGate, toRecommendation, toRiskComplianceDetails, toUseCase, USE_CASE_INCLUDE } from "@/lib/dbMapping";
import { broadcastBundle } from "@/lib/broadcastBundle";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const row = await prisma.useCase.findUnique({ where: { id }, include: USE_CASE_INCLUDE });
  if (!row) return Response.json({ error: "Use case not found." }, { status: 404 });
  if (!row.recommendation || !row.gate) {
    return Response.json({ error: "Recommendation and governance gate are required first." }, { status: 400 });
  }

  const nextVersion = row.adrs.reduce((max, a) => Math.max(max, a.version), 0) + 1;
  const useCase = toUseCase(row);
  const recommendation = toRecommendation(row.recommendation);
  const gate = toGate(row.gate);
  const riskComplianceDetails = toRiskComplianceDetails(row.riskComplianceDetails);
  const content = buildADRContent(useCase, recommendation, gate, nextVersion, riskComplianceDetails);

  const adr = await prisma.adr.create({
    data: { useCaseId: id, version: nextVersion, content },
  });

  if (gate.acknowledged) {
    await prisma.useCase.update({ where: { id }, data: { status: "approved" } });
  }

  await broadcastBundle(id);

  return Response.json({ adr: toAdr(adr) });
}
