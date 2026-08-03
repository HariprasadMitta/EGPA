"use client";

import { SessionProvider, signOut, useSession } from "next-auth/react";
import { AuthUser } from "@/types";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
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
