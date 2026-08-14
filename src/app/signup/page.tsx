"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/roles";
import { UserRole } from "@/types";

const ROLES: UserRole[] = ["requester", "steward", "governance-owner", "developer", "arb", "admin"];

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [businessUnit, setBusinessUnit] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignUp() {
    setError(null);
    if (!name.trim() || !email.trim() || !password || !role) {
      setError("Fill in your name, email, password, and role.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          organizationName: organizationName.trim() || undefined,
          businessUnit: businessUnit.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign up failed.");
        return;
      }

      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (!result || result.error) {
        setError("Account created, but sign-in failed - try signing in manually.");
        return;
      }

      // Hard navigation, not router.push: right after signIn() resolves,
      // the session cookie is set but a client-side soft transition can
      // race the proxy/middleware's read of it in production, silently
      // bouncing back to this same page with no visible error. A full
      // request always sees the cookie that was just committed.
      window.location.href = role === "developer" || role === "arb" || role === "admin" ? "/portfolio" : "/intake";
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Create an account</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        A real account with a real password, stored in the database - pick the role you want to explore.
      </p>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <label className="block text-sm font-medium">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hariprasad Mitta"
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />

        <label className="mt-4 block text-sm font-medium">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />

        <label className="mt-4 block text-sm font-medium">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />

        <label className="mt-4 block text-sm font-medium">
          Organization <span className="font-normal text-[var(--muted)]">(optional)</span>
        </label>
        <input
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          placeholder="e.g. Contoso Bank - joining an existing name links you to the same tenant"
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />

        <label className="mt-4 block text-sm font-medium">
          Business unit <span className="font-normal text-[var(--muted)]">(optional)</span>
        </label>
        <input
          value={businessUnit}
          onChange={(e) => setBusinessUnit(e.target.value)}
          placeholder="e.g. Retail Banking - scopes which use cases you see by default"
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
              <span className="mt-1 block text-xs text-[var(--muted)]">{ROLE_DESCRIPTIONS[r]}</span>
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-[var(--tier-critical)]">{error}</p>}

        <button
          onClick={handleSignUp}
          disabled={submitting}
          className="mt-6 w-full rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creating account..." : "Sign up"}
        </button>

        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--brand)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
