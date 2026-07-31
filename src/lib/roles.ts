import { UserRole } from "@/types";

// Pure role data/logic with no React/client dependency, split out of
// auth.tsx specifically so server-side code (API routes) can import it -
// a "use client" file's exports (even plain functions) cannot be imported
// from server code at all, only rendered as/passed to Client Components.

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

export function canToggleKillSwitch(role: UserRole): boolean {
  return role === "governance-owner" || role === "admin";
}
