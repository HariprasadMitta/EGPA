"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, useAuth } from "@/lib/auth";
import { UserRole } from "@/types";

const ROLES: UserRole[] = ["requester", "steward", "governance-owner", "developer", "arb", "admin"];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSignIn() {
    if (!name.trim()) {
      setError("Enter a name to continue.");
      return;
    }
    if (!role) {
      setError("Choose a role to continue.");
      return;
    }
    login({ name: name.trim(), role });
    router.push(role === "developer" || role === "arb" || role === "admin" ? "/portfolio" : "/intake");
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Sign in to Momentum AI CV</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Simulated single sign-on for this demo &mdash; pick a name and a role.
        No password, no real account is created; this only sets your session
        in this browser tab.
      </p>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <label className="block text-sm font-medium">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Priya Nandakumar"
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />

        <p className="mt-6 mb-2 text-sm font-medium">Role</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                role === r
                  ? "border-[var(--accent)] bg-[var(--tier-low-bg)]"
                  : "border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface)]"
              }`}
            >
              <span className="block font-semibold">{ROLE_LABELS[r]}</span>
              <span className="mt-1 block text-xs text-[var(--muted)]">
                {ROLE_DESCRIPTIONS[r]}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-sm text-[var(--tier-critical)]">{error}</p>
        )}

        <button
          onClick={handleSignIn}
          className="mt-6 w-full rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-strong)]"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
