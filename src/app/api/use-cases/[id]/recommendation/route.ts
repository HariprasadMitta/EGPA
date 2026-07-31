import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GOVERNANCE_TEMPLATES } from "@/lib/governance";
import { toGate, toRecommendation } from "@/lib/dbMapping";
import { broadcastBundle } from "@/lib/broadcastBundle";

export const runtime = "nodejs";

interface RecommendationBody {
  framework: string;
  tools: string[];
  harnessPattern: string;
  loopPattern: string;
  iterationCeiling: number;
  contextStrategy: string;
  rationale: string;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const useCase = await prisma.useCase.findUnique({ where: { id } });
  if (!useCase) return Response.json({ error: "Use case not found." }, { status: 404 });

  let body: RecommendationBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const template = GOVERNANCE_TEMPLATES[useCase.riskTier as keyof typeof GOVERNANCE_TEMPLATES];

  const [recommendation, gate] = await prisma.$transaction([
    prisma.recommendation.upsert({
      where: { useCaseId: id },
      update: { ...body, version: 1 },
      create: { useCaseId: id, ...body, version: 1 },
    }),
    prisma.governanceGate.upsert({
      where: { useCaseId: id },
      update: {
        riskTier: useCase.riskTier,
        requiredControls: template.requiredControls,
        hitlTier: template.hitlTier,
        requiresArbApproval: template.requiresArbApproval,
      },
      create: {
        useCaseId: id,
        riskTier: useCase.riskTier,
        requiredControls: template.requiredControls,
        hitlTier: template.hitlTier,
        acknowledged: false,
        acknowledgedItems: [],
        requiresArbApproval: template.requiresArbApproval,
        arbApproved: false,
      },
    }),
    prisma.useCase.update({ where: { id }, data: { status: "recommended" } }),
  ]);

  await broadcastBundle(id);

  return Response.json({ recommendation: toRecommendation(recommendation), gate: toGate(gate) });
}
