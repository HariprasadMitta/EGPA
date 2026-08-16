import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const entries = await prisma.mcpServerEntry.findMany({ orderBy: { createdAt: "asc" } });
  return Response.json({ entries });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can add MCP Server entries." }, { status: 403 });
  }

  let body: {
    id?: string;
    name?: string;
    publisher?: string;
    description?: string;
    status?: string;
    allowedRiskTiers?: string[];
    changeReason?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.id || !body.name || !body.publisher || !body.description || !body.status) {
    return Response.json({ error: "id, name, publisher, description, and status are required." }, { status: 400 });
  }
  const changeReason = body.changeReason?.trim();
  if (!changeReason) {
    return Response.json({ error: "A reason is required - why is this MCP server being added at this status/tier scope?" }, { status: 400 });
  }

  const entry = await prisma.mcpServerEntry.create({
    data: {
      id: body.id,
      name: body.name,
      publisher: body.publisher,
      description: body.description,
      status: body.status,
      allowedRiskTiers: body.allowedRiskTiers ?? [],
      changeReason,
    },
  });

  return Response.json({ entry });
}
