"use client";

import { useEffect } from "react";
import { logError } from "@/lib/errorLogging";

// Real Next.js App Router root error boundary - catches an error in the
// root layout itself (where error.tsx can't help, since it renders inside
// that same layout). Must render its own <html>/<body> since it replaces
// the whole layout when it fires. Logged the same structured way as every
// other real failure in this app (see src/lib/errorLogging.ts).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError("app.global-error-boundary", error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 480, margin: "6rem auto", padding: "0 1.5rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ marginTop: "0.5rem", color: "#64748b", fontSize: "0.875rem" }}>
            A real error was logged on the server. Try again below.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              borderRadius: "9999px",
              background: "#0a2a43",
              color: "white",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
