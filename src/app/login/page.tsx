"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession, signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter both email and password.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError("Incorrect email or password.");
        return;
      }

      const session = await getSession();
      const role = session?.user?.role;
      router.push(role === "developer" || role === "arb" || role === "admin" ? "/portfolio" : "/intake");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Sign in to Momentum AI CV</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Real sign-in - your account and role are looked up from the database.
      </p>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <label className="block text-sm font-medium">Email</label>
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
          placeholder="********"
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />

        {error && <p className="mt-4 text-sm text-[var(--tier-critical)]">{error}</p>}

        <button
          onClick={handleSignIn}
          disabled={submitting}
          className="mt-6 w-full rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>

        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-[var(--brand)] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
