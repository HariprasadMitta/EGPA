import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { finalizeDiscoverySession, type DiscoveryChatMessage } from "@/lib/discoveryAgent";

export const runtime = "nodejs";

// Concludes a Discovery session with a real, reasoned recommendation - one
// of process-only / extend-existing / research-first / build - never a
// bare "done," per the platform-wide rule that every decision states its
// trade-off (see GovernanceGate.arbApprovalReasoning, Recommendation.
// alternativesConsidered for the same rule elsewhere).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const row = await prisma.problemDiscoverySession.findUnique({ where: { id } });
  if (!row || row.userId !== session.user.id) {
    return Response.json({ error: "Discovery session not found." }, { status: 404 });
  }
  if (row.status !== "active") {
    return Response.json({ error: "This session has already been finalized." }, { status: 400 });
  }
  const messages = row.messages as unknown as DiscoveryChatMessage[];
  if (messages.filter((m) => m.role === "user").length === 0) {
    return Response.json({ error: "Have at least one exchange before wrapping this up." }, { status: 400 });
  }

  try {
    const { recommendedPath, rationale, problemStatement, suggestedTitle } = await finalizeDiscoverySession(messages);

    const updated = await prisma.problemDiscoverySession.update({
      where: { id },
      data: {
        status: "completed",
        recommendedPath,
        pathRationale: rationale,
        problemStatement,
        suggestedTitle,
        // A better title than the raw first-message truncation now exists.
        title: suggestedTitle,
      },
    });

    return Response.json({
      status: updated.status,
      recommendedPath: updated.recommendedPath,
      pathRationale: updated.pathRationale,
      problemStatement: updated.problemStatement,
      suggestedTitle: updated.suggestedTitle,
    });
  } catch (err) {
    return Response.json({ error: `Discovery Advisor error: ${(err as Error).message}` }, { status: 502 });
  }
}
