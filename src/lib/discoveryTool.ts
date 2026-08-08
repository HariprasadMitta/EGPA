import { prisma } from "@/lib/prisma";
import { canSeeAllUseCases } from "@/lib/roles";
import type { Prisma } from "@prisma/client";
import { UserRole } from "@/types";

export interface DiscoveryMatch {
  id: string;
  title: string;
  description: string;
  businessDomain: string;
  status: string;
  riskTier: string;
}

// Real search over this org's own UseCase records - the concrete mechanism
// behind the Discovery Advisor's "extend-existing" recommendation path
// (search_existing_use_cases), not a guess about what might already exist.
// Same tenant/business-unit visibility scoping as GET /api/use-cases.
export async function searchExistingUseCases(userId: string, query: string): Promise<DiscoveryMatch[]> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, businessUnit: true, role: true },
  });

  const clauses: Prisma.UseCaseWhereInput[] = [
    {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { businessDomain: { contains: query, mode: "insensitive" } },
      ],
    },
  ];
  if (me?.organizationId) {
    clauses.push({ OR: [{ organizationId: me.organizationId }, { organizationId: null }] });
  }
  const canSeeAllUnits = me?.role ? canSeeAllUseCases(me.role as UserRole) : false;
  if (!canSeeAllUnits && me?.businessUnit) {
    clauses.push({ businessDomain: me.businessUnit });
  }

  return prisma.useCase.findMany({
    where: { AND: clauses },
    select: { id: true, title: true, description: true, businessDomain: true, status: true, riskTier: true },
    take: 5,
    orderBy: { createdAt: "desc" },
  });
}
