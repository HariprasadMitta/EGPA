import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { classifyRisk } from "@/lib/governance";
import { toRiskComplianceDetails, toUseCase, toUseCaseBundle, USE_CASE_INCLUDE } from "@/lib/dbMapping";
import { broadcastBundle } from "@/lib/broadcastBundle";
import {
  AutonomyLevel,
  DataSensitivity,
  ExpectedUsers,
  HumanOversightFrequency,
  IntegrationSurface,
  ModelSourcing,
} from "@/types";

export const runtime = "nodejs";

interface RiskComplianceDetailsBody {
  regulatoryFrameworks: string[];
  dataResidency: string;
  dataSources: string[];
  sensitiveDataElements: string;
  retentionInputsDays: number | null;
  retentionOutputsDays: number | null;
  retentionLogsDays: number | null;
  modelSourcing: ModelSourcing;
  modelVendor: string;
  customerImpactDecision: boolean;
  humanOversightFrequency: HumanOversightFrequency;
  humanReviewSamplePercent: number | null;
  escalationOwner: string;
  explainabilityRequirement: string;
  biasFairnessTestingPlan: string;
  preProductionValidation: string;
  expectedUsageVolume: string;
  businessCriticality: string;
  fallbackRollbackPlan: string;
  encryptedAtRestInTransit: boolean;
  agentWriteAccessProduction: boolean;
  securityReviewCompleted: boolean;
  accountableOwner: string;
  usersToldAboutAi: boolean;
}

interface CreateUseCaseBody {
  title: string;
  description: string;
  businessDomain: string;
  dataSensitivity: DataSensitivity;
  autonomyLevel: AutonomyLevel;
  integrationSurface: IntegrationSurface;
  expectedUsers: ExpectedUsers;
  owner: string;
  steward: string;
  riskComplianceDetails?: RiskComplianceDetailsBody;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const rows = await prisma.useCase.findMany({
    include: USE_CASE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ bundles: rows.map(toUseCaseBundle) });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  let body: CreateUseCaseBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.title?.trim() || !body.description?.trim() || !body.owner?.trim() || !body.steward?.trim()) {
    return Response.json({ error: "Missing required fields." }, { status: 400 });
  }

  const rcd = body.riskComplianceDetails;
  const riskTier = classifyRisk({
    dataSensitivity: body.dataSensitivity,
    autonomyLevel: body.autonomyLevel,
    integrationSurface: body.integrationSurface,
    humanOversightFrequency: rcd?.humanOversightFrequency,
    customerImpactDecision: rcd?.customerImpactDecision,
  });

  const id = `uc-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const row = await prisma.useCase.create({
    data: {
      id,
      title: body.title,
      description: body.description,
      businessDomain: body.businessDomain || "Unspecified",
      dataSensitivity: body.dataSensitivity,
      autonomyLevel: body.autonomyLevel,
      integrationSurface: body.integrationSurface,
      expectedUsers: body.expectedUsers,
      owner: body.owner,
      steward: body.steward,
      riskTier,
      status: "submitted",
      ownerUserId: session.user.id,
      riskComplianceDetails: rcd
        ? {
            create: {
              regulatoryFrameworks: rcd.regulatoryFrameworks,
              dataResidency: rcd.dataResidency,
              dataSources: rcd.dataSources,
              sensitiveDataElements: rcd.sensitiveDataElements,
              retentionInputsDays: rcd.retentionInputsDays,
              retentionOutputsDays: rcd.retentionOutputsDays,
              retentionLogsDays: rcd.retentionLogsDays,
              modelSourcing: rcd.modelSourcing,
              modelVendor: rcd.modelVendor,
              customerImpactDecision: rcd.customerImpactDecision,
              humanOversightFrequency: rcd.humanOversightFrequency,
              humanReviewSamplePercent: rcd.humanReviewSamplePercent,
              escalationOwner: rcd.escalationOwner,
              explainabilityRequirement: rcd.explainabilityRequirement,
              biasFairnessTestingPlan: rcd.biasFairnessTestingPlan,
              preProductionValidation: rcd.preProductionValidation,
              expectedUsageVolume: rcd.expectedUsageVolume,
              businessCriticality: rcd.businessCriticality,
              fallbackRollbackPlan: rcd.fallbackRollbackPlan,
              encryptedAtRestInTransit: rcd.encryptedAtRestInTransit,
              agentWriteAccessProduction: rcd.agentWriteAccessProduction,
              securityReviewCompleted: rcd.securityReviewCompleted,
              accountableOwner: rcd.accountableOwner,
              usersToldAboutAi: rcd.usersToldAboutAi,
            },
          }
        : undefined,
    },
    include: { riskComplianceDetails: true },
  });

  await broadcastBundle(id);

  return Response.json({
    useCase: toUseCase(row),
    riskComplianceDetails: toRiskComplianceDetails(row.riskComplianceDetails),
  });
}
