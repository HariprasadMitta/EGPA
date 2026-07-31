"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AuthUser, UserRole } from "@/types";

const STORAGE_KEY = "momentum-cv-auth-v1";

export const ROLE_LABELS: Record<UserRole, string> = {
  requester: "Requester",
  steward: "Steward / Architect",
  "governance-owner": "Governance Owner",
  developer: "Developer",
  arb: "Review Board (ARB)",
  admin: "Admin",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  requester: "Submits use cases and tracks their status through governance.",
  steward: "Bridges business intent and technical implementation; reviews recommendations.",
  "governance-owner": "Signs off on governance gates and owns the control plane.",
  developer: "Gets single-sign-on access to run and monitor approved use cases.",
  arb: "Manually reviews and approves Critical-tier use cases before they can proceed - no one else can clear this sign-off.",
  admin: "Full access - can do everything every other role can do, including Developer tools and ARB sign-off.",
};

export function canAccessDeveloperTools(role: UserRole): boolean {
  return role === "developer" || role === "admin";
}

export function canApproveArb(role: UserRole): boolean {
  return role === "arb" || role === "admin";
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // See store.tsx for why this one-time post-mount sessionStorage read is
    // intentional rather than a lint-flagged setState-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(loadUser());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (user) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  }, [user, hydrated]);

  const login = useCallback((newUser: AuthUser) => setUser(newUser), []);
  const logout = useCallback(() => setUser(null), []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
