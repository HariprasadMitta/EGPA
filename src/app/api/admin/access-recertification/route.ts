import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ACCESS_RECERT_DAYS = 180;
const ELEVATED_ROLES = ["governance-owner", "arb", "admin"];

// Real access recertification - periodically re-confirm who actually still
// needs governance-owner/ARB/admin rights, separate from recertifying an
// individual use case's governance sign-off. The real gap this closes:
// use-case recertification was already built, but nothing tracked whether
// a *person's* elevated access was still appropriate (joiner-mover-leaver
// hygiene), which is exactly the kind of thing a real access review finds
// missing.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can review access recertification." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { role: { in: ELEVATED_ROLES } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true, roleRecertifiedAt: true },
  });

  const now = Date.now();
  return Response.json({
    users: users.map((u) => {
      const lastCheck = u.roleRecertifiedAt ?? u.createdAt;
      const daysSince = Math.floor((now - lastCheck.getTime()) / (24 * 60 * 60 * 1000));
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        roleRecertifiedAt: u.roleRecertifiedAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        daysSinceLastCheck: daysSince,
        overdue: daysSince >= ACCESS_RECERT_DAYS,
      };
    }),
    recertIntervalDays: ACCESS_RECERT_DAYS,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can recertify access." }, { status: 403 });
  }

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.userId) return Response.json({ error: "userId is required." }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: body.userId } });
  if (!target || !ELEVATED_ROLES.includes(target.role)) {
    return Response.json({ error: "User not found or doesn't hold an elevated role." }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id: body.userId },
    data: { roleRecertifiedAt: new Date() },
  });

  return Response.json({ id: updated.id, roleRecertifiedAt: updated.roleRecertifiedAt?.toISOString() ?? null });
}
