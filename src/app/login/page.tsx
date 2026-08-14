"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in (e.g. navigated back here manually, or a stale tab) -
  // don't show a sign-in form for a session that already exists.
  useEffect(() => {
    if (!user) return;
    window.location.href = "/";
  }, [user]);

  if (user) return null;

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

      // Hard navigation, not router.push: right after signIn() resolves,
      // the session cookie is set but a client-side soft transition can
      // race the proxy/middleware's read of it in production, silently
      // bouncing back to this same page with no visible error. A full
      // request always sees the cookie that was just committed.
      window.location.href = "/";
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Sign in to EGPA</h1>
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

        <div className="mt-4 flex items-center justify-between">
          <label className="block text-sm font-medium">Password</label>
          <Link href="/forgot-password" className="text-xs font-medium text-[var(--brand)] hover:underline">
            Forgot password?
          </Link>
        </div>
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

        {process.env.NEXT_PUBLIC_GOOGLE_SSO_ENABLED === "true" && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-[var(--muted)]">
              <div className="h-px flex-1 bg-[var(--border)]" />
              or
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="w-full rounded-full border border-[var(--border)] bg-[var(--background)] px-6 py-3 text-sm font-semibold transition-colors hover:bg-[var(--surface)]"
            >
              Sign in with Google (SSO)
            </button>
            <p className="mt-2 text-center text-xs text-[var(--muted)]">
              Real Auth.js OIDC provider - first sign-in creates a real account with the default Requester role.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
