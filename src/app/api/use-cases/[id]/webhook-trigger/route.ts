import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDeveloperTools } from "@/lib/roles";
import { generateToken, hashToken } from "@/lib/webhookAuth";
import { broadcastBundle } from "@/lib/broadcastBundle";
import { UserRole } from "@/types";

export const runtime = "nodejs";

// Generates (or regenerates) a real bearer token for this use case's webhook
// trigger. The plaintext token is returned exactly once - only its hash is
// ever persisted - the same UX real API-key systems (GitHub PATs, Stripe
// keys) use.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!canAccessDeveloperTools(session.user.role as UserRole)) {
    return Response.json(
      { error: "Only a Developer or Admin can manage automation triggers." },
      { status: 403 }
    );
  }

  const { id: useCaseId } = await params;
  const useCase = await prisma.useCase.findUnique({ where: { id: useCaseId } });
  if (!useCase) return Response.json({ error: "Use case not found." }, { status: 404 });

  const token = generateToken();
  const tokenHash = hashToken(token);

  await prisma.webhookTrigger.upsert({
    where: { useCaseId },
    create: { useCaseId, tokenHash, enabled: true },
    update: { tokenHash, enabled: true },
  });

  await broadcastBundle(useCaseId);

  return Response.json({ token });
}

// Enables/disables the trigger without touching the token.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!canAccessDeveloperTools(session.user.role as UserRole)) {
    return Response.json(
      { error: "Only a Developer or Admin can manage automation triggers." },
      { status: 403 }
    );
  }

  const { id: useCaseId } = await params;

  let body: { enabled: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const existing = await prisma.webhookTrigger.findUnique({ where: { useCaseId } });
  if (!existing) {
    return Response.json(
      { error: "No webhook trigger exists yet for this use case - generate a token first." },
      { status: 404 }
    );
  }

  await prisma.webhookTrigger.update({ where: { useCaseId }, data: { enabled: Boolean(body.enabled) } });

  await broadcastBundle(useCaseId);

  return Response.json({ ok: true });
}
