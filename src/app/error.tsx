"use client";

import { useEffect } from "react";
import Link from "next/link";
import { logError } from "@/lib/errorLogging";

// Real Next.js App Router error boundary - catches a rendering/runtime
// error in any page under this layout instead of showing Next's generic
// crash screen with no server-side trace. Logged the same structured way
// every other real failure in this app is (see src/lib/errorLogging.ts),
// so it actually shows up in Vercel's Runtime Logs.
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError("app.error-boundary", error, { digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="text-xl font-semibold text-[var(--brand-strong)]">Something went wrong</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        A real error was logged on the server. Try again, or head back to the landing page if it keeps happening.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-strong)]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--background)]"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
