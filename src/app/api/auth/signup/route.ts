import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/types";

export const runtime = "nodejs";

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
}

export async function POST(request: Request) {
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

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role },
  });

  return Response.json({ id: user.id, email: user.email });
}
