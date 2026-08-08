import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { DiscoveryChatMessage } from "@/lib/discoveryAgent";

export const runtime = "nodejs";

const PATH_LABELS: Record<string, string> = {
  "process-only": "Process-only fix - no agent warranted",
  "extend-existing": "Extend an existing use case",
  "research-first": "Research first before committing to a build",
  build: "Build - proceed to Intake",
};

// Real downloadable package for one Discovery session - the full actual
// transcript plus the real reasoned recommendation, not a fabricated
// executive summary. Same "package to hand off" spirit as the audit
// evidence export, just for pre-Intake discovery instead of a governed
// use case.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const row = await prisma.problemDiscoverySession.findUnique({ where: { id } });
  if (!row || row.userId !== session.user.id) {
    return Response.json({ error: "Discovery session not found." }, { status: 404 });
  }

  const messages = row.messages as unknown as DiscoveryChatMessage[];

  const lines: string[] = [];
  lines.push(`# Discovery Session: ${row.title ?? "Untitled"}`);
  lines.push("");
  lines.push(`Generated ${new Date().toISOString()} by ${session.user.name}.`);
  lines.push("");
  lines.push(`**Status:** ${row.status}`);
  if (row.recommendedPath) {
    lines.push(`**Recommended path:** ${PATH_LABELS[row.recommendedPath] ?? row.recommendedPath}`);
  }
  if (row.pathRationale) {
    lines.push("");
    lines.push("**Reasoning:**");
    lines.push("");
    lines.push(row.pathRationale);
  }
  if (row.problemStatement) {
    lines.push("");
    lines.push("**Problem statement (submission-ready):**");
    lines.push("");
    lines.push(row.problemStatement);
  }
  if (row.handedOffUseCaseId) {
    lines.push("");
    lines.push(`**Handed off to use case:** ${row.handedOffUseCaseId}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Full transcript");
  lines.push("");
  for (const m of messages) {
    const speaker = m.role === "user" ? session.user.name : m.role === "tool" ? "Discovery Advisor (tool call)" : "Discovery Advisor";
    lines.push(`**${speaker}:** ${m.content}`);
    lines.push("");
  }

  const doc = lines.join("\n");
  const safeTitle = (row.title ?? "untitled").replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  return new Response(doc, {
    headers: {
      "content-type": "text/markdown",
      "content-disposition": `attachment; filename="discovery-${safeTitle}-${new Date().toISOString().slice(0, 10)}.md"`,
    },
  });
}
