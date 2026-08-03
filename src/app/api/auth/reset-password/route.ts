import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/webhookAuth";
import { checkAuthRateLimit } from "@/lib/authRateLimit";
import { clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const MAX_ATTEMPTS_PER_IP_PER_WINDOW = 10;

interface ResetPasswordBody {
  token: string;
  newPassword: string;
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const ipLimit = await checkAuthRateLimit("reset-password-ip", ip, MAX_ATTEMPTS_PER_IP_PER_WINDOW);
  if (!ipLimit.allowed) {
    return Response.json(
      { error: "Too many attempts from this network recently. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  let body: ResetPasswordBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const token = body.token?.trim();
  const newPassword = body.newPassword;
  if (!token || !newPassword) {
    return Response.json({ error: "Token and new password are required." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const tokenHash = hashToken(token);
  const resetToken = await prisma.passwordResetToken.findFirst({
    where: { tokenHash },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return Response.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);

  return Response.json({ message: "Password updated. You can now sign in with your new password." });
}
