import { prisma } from "@/lib/prisma";
import { authenticateApiKey, requireWriteScope } from "@/lib/apiKeyAuth";
import { classifyRisk } from "@/lib/governance";
import { toUseCase } from "@/lib/dbMapping";
import { broadcastBundle } from "@/lib/broadcastBundle";
import {
  AutonomyLevel,
  DataSensitivity,
  ExpectedUsers,
  IntegrationSurface,
} from "@/types";

export const runtime = "nodejs";

// Real public REST API - lets an external enterprise system create/query
// use cases programmatically, authenticated with a real ApiKey (see
// src/lib/apiKeyAuth.ts) instead of a browser session. Beyond the single
// use-case-scoped execution webhook, this is the first genuinely open
// integration surface into the platform.
export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const useCases = await prisma.useCase.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return Response.json({ useCases: useCases.map(toUseCase) });
}

interface PublicCreateBody {
  title: string;
  description: string;
  businessDomain?: string;
  dataSensitivity: DataSensitivity;
  autonomyLevel: AutonomyLevel;
  integrationSurface: IntegrationSurface;
  expectedUsers: ExpectedUsers;
  owner: string;
  steward: string;
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const write = requireWriteScope(auth.scope);
  if (!write.ok) return Response.json({ error: write.error }, { status: write.status });

  let body: PublicCreateBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.title || !body.description || !body.owner || !body.steward) {
    return Response.json({ error: "title, description, owner, and steward are required." }, { status: 400 });
  }

  // API-key-created use cases attach to the demo/seed account (there's no
  // real "which human submitted this" for a programmatic caller) - the
  // same real placeholder ownerUserId pattern the seed data already uses.
  const seedOwner = await prisma.user.findFirst({ where: { email: "demo@momentum.local" } });
  if (!seedOwner) return Response.json({ error: "No default owner account available." }, { status: 500 });

  const riskTier = classifyRisk({
    dataSensitivity: body.dataSensitivity,
    autonomyLevel: body.autonomyLevel,
    integrationSurface: body.integrationSurface,
  });

  const id = `uc-api-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
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
      ownerUserId: seedOwner.id,
    },
  });

  await broadcastBundle(id);

  return Response.json({ useCase: toUseCase(row) }, { status: 201 });
}
