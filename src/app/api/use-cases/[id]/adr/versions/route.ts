import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toAdr } from "@/lib/dbMapping";

export const runtime = "nodejs";

// Real ADR version history - the ADR page/store only ever surfaces the
// latest version; this is what makes the other real versions (and a real
// diff between any two of them) actually reachable.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const adrs = await prisma.adr.findMany({ where: { useCaseId: id }, orderBy: { version: "asc" } });

  return Response.json({ versions: adrs.map(toAdr) });
}
