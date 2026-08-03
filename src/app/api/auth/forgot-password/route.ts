import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/webhookAuth";
import { checkAuthRateLimit } from "@/lib/authRateLimit";
import { clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const MAX_REQUESTS_PER_IP_PER_WINDOW = 5;
const TOKEN_TTL_MS = 30 * 60 * 1000;

interface ForgotPasswordBody {
  email: string;
}

// No email service is wired up (deliberate product decision) - the reset
// link is generated and handed straight back in the response body for the
// UI to display in-app, instead of being emailed out.
export async function POST(request: Request) {
  const ip = clientIp(request);
  const ipLimit = await checkAuthRateLimit("forgot-password-ip", ip, MAX_REQUESTS_PER_IP_PER_WINDOW);
  if (!ipLimit.allowed) {
    return Response.json(
      { error: "Too many reset requests from this network recently. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  let body: ForgotPasswordBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return Response.json({ error: "Email is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Same response whether or not the account exists - otherwise this
  // endpoint becomes a real account-enumeration oracle.
  const genericResponse = {
    message:
      "If an account exists for that email, a reset link has been generated below.",
  };
  if (!user) {
    return Response.json(genericResponse);
  }

  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const resetLink = `${origin}/reset-password?token=${token}`;

  return Response.json({ ...genericResponse, resetLink });
}
