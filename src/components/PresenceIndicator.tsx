"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

const STALE_MS = 15_000;
const PING_INTERVAL_MS = 5_000;

// Real "who else is viewing this" - pings this use case's presence channel
// every few seconds and listens for other real users' pings over the same
// real Redis-backed SSE mechanism the live-sync bundle updates already use
// (src/lib/presence.ts). A user drops off the list ~15s after their last
// real ping (tab closed, navigated away) - no explicit "leave" event needed.
export function PresenceIndicator({ useCaseId }: { useCaseId: string }) {
  const { user } = useAuth();
  const [others, setOthers] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;

    const ping = () => {
      fetch(`/api/use-cases/${useCaseId}/presence`, { method: "POST" }).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, PING_INTERVAL_MS);

    const source = new EventSource(`/api/use-cases/${useCaseId}/presence`);
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { userName: string; at: number };
        if (data.userName === user.name) return;
        setOthers((prev) => ({ ...prev, [data.userName]: data.at }));
      } catch {
        // Skip a malformed event.
      }
    };

    const prune = setInterval(() => {
      setOthers((prev) => {
        const now = Date.now();
        const next: Record<string, number> = {};
        for (const [name, at] of Object.entries(prev)) {
          if (now - at < STALE_MS) next[name] = at;
        }
        return next;
      });
    }, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(prune);
      source.close();
    };
  }, [useCaseId, user]);

  const names = Object.keys(others);
  if (names.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-[var(--status-current)]/30 bg-[var(--status-current-bg)] px-3 py-1 text-xs font-medium text-[var(--status-current)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-current)] status-blink" />
      {names.length === 1 ? `${names[0]} is also viewing this` : `${names.join(", ")} are also viewing this`}
    </div>
  );
}
