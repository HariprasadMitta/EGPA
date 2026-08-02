import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Real, DB-backed Model Registry - replaces the previously-hardcoded
// src/lib/modelRegistry.ts arrays. Any signed-in user can read it (same
// shared visibility as everything else); only Admin can add entries -
// this is the concrete "admins can actually manage the allowlist" lifecycle
// the static version never had.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const entries = await prisma.modelRegistryEntry.findMany({ orderBy: { createdAt: "asc" } });
  return Response.json({ entries });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can add Model Registry entries." }, { status: 403 });
  }

  let body: { id?: string; name?: string; vendor?: string; version?: string; status?: string; allowedRiskTiers?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.id || !body.name || !body.vendor || !body.version || !body.status) {
    return Response.json({ error: "id, name, vendor, version, and status are required." }, { status: 400 });
  }

  const entry = await prisma.modelRegistryEntry.create({
    data: {
      id: body.id,
      name: body.name,
      vendor: body.vendor,
      version: body.version,
      status: body.status,
      allowedRiskTiers: body.allowedRiskTiers ?? [],
    },
  });

  return Response.json({ entry });
}
