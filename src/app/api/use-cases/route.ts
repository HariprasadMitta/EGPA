import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { classifyRisk } from "@/lib/governance";
import { toUseCase, toUseCaseBundle, USE_CASE_INCLUDE } from "@/lib/dbMapping";
import {
  AutonomyLevel,
  DataSensitivity,
  ExpectedUsers,
  IntegrationSurface,
} from "@/types";

export const runtime = "nodejs";

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

  const riskTier = classifyRisk({
    dataSensitivity: body.dataSensitivity,
    autonomyLevel: body.autonomyLevel,
    integrationSurface: body.integrationSurface,
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
    },
  });

  return Response.json({ useCase: toUseCase(row) });
}
