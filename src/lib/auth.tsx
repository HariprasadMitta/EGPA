"use client";

import { Session } from "next-auth";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { AuthUser } from "@/types";

export function AuthProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  // Seeded with the server-known session (see layout.tsx's `await auth()`)
  // so useSession() is "authenticated" on first client render instead of
  // starting "loading" and only resolving after its own /api/auth/session
  // round-trip - without this, every hard navigation (see login/signup's
  // window.location.href) briefly re-renders NavBar as signed-out.
  return <SessionProvider session={session}>{children}</SessionProvider>;
}

interface AuthContextValue {
  user: AuthUser | null;
  logout: () => void;
}

export function useAuth(): AuthContextValue {
  const { data: session } = useSession();
  const user: AuthUser | null = session?.user
    ? { id: session.user.id, name: session.user.name, role: session.user.role }
    : null;

  return {
    user,
    logout: () => {
      void signOut({ redirectTo: "/" });
    },
  };
}
