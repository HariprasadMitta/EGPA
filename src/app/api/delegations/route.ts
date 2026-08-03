import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/types";

export const runtime = "nodejs";

const VALID_SCOPES = ["arb_approval", "governance_owner_actions"];

function scopeAllowedForRole(scope: string, role: UserRole): boolean {
  if (role === "admin") return true;
  if (role === "arb") return scope === "arb_approval";
  if (role === "governance-owner") return scope === "governance_owner_actions";
  return false;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const [given, received] = await Promise.all([
    prisma.approvalDelegation.findMany({
      where: { delegatorUserId: session.user.id },
      include: { delegate: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.approvalDelegation.findMany({
      where: { delegateUserId: session.user.id },
      include: { delegator: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return Response.json({
    given: given.map((d) => ({
      id: d.id,
      delegateName: d.delegate.name,
      delegateEmail: d.delegate.email,
      scope: d.scope,
      startsAt: d.startsAt.toISOString(),
      endsAt: d.endsAt.toISOString(),
      revoked: d.revoked,
    })),
    received: received.map((d) => ({
      id: d.id,
      delegatorName: d.delegator.name,
      delegatorEmail: d.delegator.email,
      scope: d.scope,
      startsAt: d.startsAt.toISOString(),
      endsAt: d.endsAt.toISOString(),
      revoked: d.revoked,
    })),
  });
}

interface CreateDelegationBody {
  delegateEmail?: string;
  scope?: string;
  startsAt?: string;
  endsAt?: string;
}

// Real, audited delegation - you can only delegate your OWN authority
// (delegatorUserId is always the session user, never a body param), for a
// scope your own role actually holds, over a real time window. This is
// the formal replacement for "just share your login while you're out."
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  let body: CreateDelegationBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.delegateEmail || !body.scope || !body.startsAt || !body.endsAt) {
    return Response.json({ error: "delegateEmail, scope, startsAt, and endsAt are all required." }, { status: 400 });
  }
  if (!VALID_SCOPES.includes(body.scope)) {
    return Response.json({ error: "scope must be 'arb_approval' or 'governance_owner_actions'." }, { status: 400 });
  }
  if (!scopeAllowedForRole(body.scope, session.user.role as UserRole)) {
    return Response.json({ error: "You can only delegate authority your own role actually holds." }, { status: 403 });
  }

  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return Response.json({ error: "endsAt must be a valid date after startsAt." }, { status: 400 });
  }

  const delegate = await prisma.user.findUnique({ where: { email: body.delegateEmail.trim().toLowerCase() } });
  if (!delegate) return Response.json({ error: "No account found with that email." }, { status: 404 });
  if (delegate.id === session.user.id) {
    return Response.json({ error: "You can't delegate authority to yourself." }, { status: 400 });
  }

  const created = await prisma.approvalDelegation.create({
    data: {
      delegatorUserId: session.user.id,
      delegateUserId: delegate.id,
      scope: body.scope,
      startsAt,
      endsAt,
    },
  });

  return Response.json({ id: created.id });
}
