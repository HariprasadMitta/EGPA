"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setMessage(null);
    setResetLink(null);
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setMessage(data.message);
      if (data.resetLink) setResetLink(data.resetLink);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Reset your password</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        No email service is wired up here - enter your account email and the reset link will be shown
        directly on this page.
      </p>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <label className="block text-sm font-medium">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />

        {error && <p className="mt-4 text-sm text-[var(--tier-critical)]">{error}</p>}
        {message && <p className="mt-4 text-sm text-[var(--tier-low)]">{message}</p>}

        {resetLink && (
          <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Your reset link</p>
            <a href={resetLink} className="mt-1 block break-all text-sm font-medium text-[var(--brand)] hover:underline">
              {resetLink}
            </a>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="mt-6 w-full rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Requesting..." : "Get reset link"}
        </button>

        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          <Link href="/login" className="font-medium text-[var(--brand)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
