import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import type { JWT } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/types";

// Real SSO: Google OAuth via Auth.js, only registered when real credentials
// are configured (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET - see
// .env.local.example). Same pattern any other OIDC/SAML provider (Okta,
// Azure AD) would slot into; Google chosen because it's free and
// immediately testable without a paid enterprise IdP account.
const providers: Provider[] = [
  Credentials({
    credentials: {
      email: {},
      password: {},
    },
    authorize: async (credentials) => {
      const email = credentials?.email;
      const password = credentials?.password;
      if (typeof email !== "string" || typeof password !== "string") return null;

      const user = await prisma.user.findUnique({ where: { email } });
      // SSO-only accounts (created via Google, never given a local
      // password) have passwordHash === null - can't sign in with a
      // password, not a crash.
      if (!user || !user.passwordHash) return null;

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return null;

      return { id: user.id, name: user.name, email: user.email, role: user.role };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    // No database adapter is configured (deliberate - see Phase 2 design
    // notes), so Google sign-ins don't auto-create a User row the way an
    // adapter-backed flow would. Do that real upsert here instead: first
    // Google sign-in for an email creates a real User row (default role
    // "requester" - same as the credentials signup default), subsequent
    // ones just link googleId if it wasn't set yet.
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email;
        if (!email) return false;
        const existing = await prisma.user.findUnique({ where: { email } });
        if (!existing) {
          await prisma.user.create({
            data: {
              email,
              name: user.name ?? email,
              role: "requester",
              googleId: account.providerAccountId,
            },
          });
        } else if (!existing.googleId) {
          await prisma.user.update({ where: { email }, data: { googleId: account.providerAccountId } });
        }
      }
      return true;
    },
    async jwt({ token, user, account }): Promise<JWT> {
      if (user) {
        if (account?.provider === "google" && user.email) {
          // The provider's own `user.id` isn't this app's real User.id -
          // look up the real DB row by email for the real id/role.
          const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role as UserRole;
          }
        } else {
          token.id = user.id;
          token.role = (user as { role: UserRole }).role;
        }
      }
      return token;
    },
    session({ session, token }) {
      const t = token as JWT;
      if (t.id) session.user.id = t.id;
      if (t.role) session.user.role = t.role;
      return session;
    },
  },
});
