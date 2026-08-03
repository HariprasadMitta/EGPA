import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/types";
import { checkAuthRateLimit } from "@/lib/authRateLimit";
import { clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const MAX_SIGNUPS_PER_IP_PER_WINDOW = 5;

const VALID_ROLES: UserRole[] = [
  "requester",
  "steward",
  "governance-owner",
  "developer",
  "arb",
  "admin",
];

interface SignupRequestBody {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  organizationName?: string;
  businessUnit?: string;
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const ipLimit = await checkAuthRateLimit("signup-ip", ip, MAX_SIGNUPS_PER_IP_PER_WINDOW);
  if (!ipLimit.allowed) {
    return Response.json(
      { error: "Too many accounts created from this network recently. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  let body: SignupRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const role = body.role;
  const organizationName = body.organizationName?.trim();
  const businessUnit = body.businessUnit?.trim() || null;

  if (!name || !email || !password || !role) {
    return Response.json({ error: "Name, email, password, and role are all required." }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return Response.json({ error: "Invalid role." }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  // Real find-or-create org (case-insensitive on name) so two people who
  // both type "Acme Corp" land in the same tenant instead of silently
  // forking into two - organization is optional, so an account created
  // without one keeps the pre-multi-tenancy behavior of global visibility.
  let organizationId: string | null = null;
  if (organizationName) {
    const org =
      (await prisma.organization.findFirst({
        where: { name: { equals: organizationName, mode: "insensitive" } },
      })) ?? (await prisma.organization.create({ data: { name: organizationName } }));
    organizationId = org.id;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role, organizationId, businessUnit },
  });

  return Response.json({ id: user.id, email: user.email });
}
