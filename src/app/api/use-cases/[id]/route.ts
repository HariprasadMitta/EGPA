import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { classifyRisk, GOVERNANCE_TEMPLATES } from "@/lib/governance";
import { logAuditEntry } from "@/lib/audit";
import { sendNotification } from "@/lib/notifications";
import { broadcastBundle } from "@/lib/broadcastBundle";
import { toUseCase } from "@/lib/dbMapping";
import { AutonomyLevel, DataSensitivity, HumanOversightFrequency, IntegrationSurface, RiskTier } from "@/types";

export const runtime = "nodejs";

interface AmendBody {
  dataSensitivity?: DataSensitivity;
  autonomyLevel?: AutonomyLevel;
  integrationSurface?: IntegrationSurface;
  humanOversightFrequency?: HumanOversightFrequency;
  customerImpactDecision?: boolean;
}

// Real material-change re-approval: today an approved use case's governance
// sign-off is assumed to hold forever, even if the risk-relevant inputs it
// was scored on later change. This is the one place that can actually
// change those inputs post-approval, and it unconditionally forces the
// governance gate (and ARB, if the new tier needs it) back open - the
// change itself, not just a shift in the computed tier number, is what
// triggers re-approval.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const useCase = await prisma.useCase.findUnique({
    where: { id },
    include: { riskComplianceDetails: true, gate: true },
  });
  if (!useCase) return Response.json({ error: "Use case not found." }, { status: 404 });

  let body: AmendBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const nextDataSensitivity = body.dataSensitivity ?? (useCase.dataSensitivity as DataSensitivity);
  const nextAutonomyLevel = body.autonomyLevel ?? (useCase.autonomyLevel as AutonomyLevel);
  const nextIntegrationSurface = body.integrationSurface ?? (useCase.integrationSurface as IntegrationSurface);
  const rcd = useCase.riskComplianceDetails;
  const nextHumanOversight =
    body.humanOversightFrequency ?? (rcd?.humanOversightFrequency as HumanOversightFrequency | undefined);
  const nextCustomerImpact = body.customerImpactDecision ?? rcd?.customerImpactDecision;

  const changes: string[] = [];
  if (nextDataSensitivity !== useCase.dataSensitivity) changes.push(`data sensitivity: ${useCase.dataSensitivity} -> ${nextDataSensitivity}`);
  if (nextAutonomyLevel !== useCase.autonomyLevel) changes.push(`autonomy level: ${useCase.autonomyLevel} -> ${nextAutonomyLevel}`);
  if (nextIntegrationSurface !== useCase.integrationSurface) changes.push(`integration surface: ${useCase.integrationSurface} -> ${nextIntegrationSurface}`);
  if (rcd && nextHumanOversight !== rcd.humanOversightFrequency) changes.push(`human oversight: ${rcd.humanOversightFrequency} -> ${nextHumanOversight}`);
  if (rcd && nextCustomerImpact !== rcd.customerImpactDecision) changes.push(`customer-impact decision: ${rcd.customerImpactDecision} -> ${nextCustomerImpact}`);

  if (changes.length === 0) {
    return Response.json({ error: "No risk-relevant fields changed." }, { status: 400 });
  }

  const newRiskTier: RiskTier = classifyRisk({
    dataSensitivity: nextDataSensitivity,
    autonomyLevel: nextAutonomyLevel,
    integrationSurface: nextIntegrationSurface,
    humanOversightFrequency: nextHumanOversight,
    customerImpactDecision: nextCustomerImpact,
  });
  const template = GOVERNANCE_TEMPLATES[newRiskTier];

  await prisma.$transaction([
    prisma.useCase.update({
      where: { id },
      data: {
        dataSensitivity: nextDataSensitivity,
        autonomyLevel: nextAutonomyLevel,
        integrationSurface: nextIntegrationSurface,
        riskTier: newRiskTier,
        status: "recommended",
      },
    }),
    ...(rcd
      ? [
          prisma.riskComplianceDetails.update({
            where: { useCaseId: id },
            data: {
              humanOversightFrequency: nextHumanOversight,
              customerImpactDecision: nextCustomerImpact ?? false,
            },
          }),
        ]
      : []),
    ...(useCase.gate
      ? [
          prisma.governanceGate.update({
            where: { useCaseId: id },
            data: {
              riskTier: newRiskTier,
              requiredControls: template.requiredControls,
              hitlTier: template.hitlTier,
              requiresArbApproval: template.requiresArbApproval,
              acknowledged: false,
              acknowledgedItems: [],
              acknowledgedAt: null,
              arbApproved: false,
              arbApprovedBy: null,
              arbApprovedAt: null,
            },
          }),
        ]
      : []),
  ]);

  await logAuditEntry({
    useCaseId: id,
    actorUserId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "material_change_reapproval",
    detail: `Risk tier ${useCase.riskTier} -> ${newRiskTier}. Changed: ${changes.join("; ")}`,
  });

  await sendNotification({
    kind: "material_change_reapproval",
    useCaseTitle: useCase.title,
    useCaseId: id,
    oldRiskTier: useCase.riskTier,
    newRiskTier,
  });

  await broadcastBundle(id);

  const updated = await prisma.useCase.findUnique({ where: { id } });
  return Response.json({ useCase: toUseCase(updated!), newRiskTier, changes });
}
