import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeEntryHash, GENESIS } from "@/lib/auditChain";

export const runtime = "nodejs";

interface VerifyResult {
  totalEntries: number;
  verifiedEntries: number;
  legacyEntries: number;
  tamperedEntryIds: string[];
  chainIntact: boolean;
}

// Real verification, not a display of the stored hash - recomputes every
// entry's hash from its own real fields plus the previous entry's real
// hash, and compares against what's stored. A row edited directly in the
// database (bypassing logAuditEntry entirely) will not recompute to its
// stored hash, and every entry after it breaks too since prevHash no
// longer matches. Entries created before this feature shipped have no real
// hash to check (hash === "") - reported as "legacy", not silently passed
// or wrongly flagged as tampered.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const entries = await prisma.auditLogEntry.findMany({
    where: { useCaseId: id },
    orderBy: { createdAt: "asc" },
  });

  const result: VerifyResult = {
    totalEntries: entries.length,
    verifiedEntries: 0,
    legacyEntries: 0,
    tamperedEntryIds: [],
    chainIntact: true,
  };

  let expectedPrevHash = GENESIS;
  for (const entry of entries) {
    if (!entry.hash) {
      result.legacyEntries += 1;
      // A legacy row breaks the chain going forward too - the entry right
      // after it can't be checked against a real prevHash either.
      expectedPrevHash = entry.prevHash || GENESIS;
      continue;
    }

    const recomputed = computeEntryHash(entry.prevHash, {
      useCaseId: entry.useCaseId,
      actorUserId: entry.actorUserId,
      actorName: entry.actorName,
      action: entry.action,
      detail: entry.detail,
      createdAt: entry.createdAt,
    });

    const hashMatches = recomputed === entry.hash;
    const linkMatches = entry.prevHash === expectedPrevHash;

    if (hashMatches && linkMatches) {
      result.verifiedEntries += 1;
    } else {
      result.tamperedEntryIds.push(entry.id);
      result.chainIntact = false;
    }

    expectedPrevHash = entry.hash;
  }

  return Response.json(result);
}
