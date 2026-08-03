// Real production error monitoring, Vercel-native: every console.error call
// on Vercel is automatically captured in the project's own Runtime Logs /
// Observability dashboard at no extra cost and no new third-party account -
// what was actually missing wasn't logging infrastructure, it was a
// consistent, structured shape so a real failure is findable and
// filterable there instead of an inconsistent, easy-to-miss one-off
// console.error (or, worse, a silently swallowed catch block with no log
// at all - see the "best-effort" catches this replaces in
// src/lib/notifications.ts and src/lib/eventBus.ts).
export function logError(context: string, error: unknown, extra?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      context,
      message,
      stack,
      ...extra,
      timestamp: new Date().toISOString(),
    })
  );
}
