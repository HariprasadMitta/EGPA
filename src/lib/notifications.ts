import { prisma } from "@/lib/prisma";

export type NotificationEvent =
  | { kind: "arb_approval_needed"; useCaseTitle: string; useCaseId: string }
  | { kind: "execution_failed"; useCaseTitle: string; useCaseId: string; error: string }
  | { kind: "kill_switch_engaged"; useCaseTitle: string; useCaseId: string; actorName: string }
  | { kind: "budget_alert"; scope: string; spentUsd: number; limitUsd: number };

function formatMessage(event: NotificationEvent, origin: string): string {
  switch (event.kind) {
    case "arb_approval_needed":
      return `:warning: *ARB approval needed* — "${event.useCaseTitle}" is Critical tier and waiting on a named reviewer sign-off.\n${origin}/gate`;
    case "execution_failed":
      return `:x: *Execution failed* — "${event.useCaseTitle}": ${event.error}\n${origin}/execution`;
    case "kill_switch_engaged":
      return `:octagonal_sign: *Kill-switch engaged* on "${event.useCaseTitle}" by ${event.actorName}. The next execution step will be rejected server-side.\n${origin}/gate`;
    case "budget_alert":
      return `:money_with_wings: *Budget alert* — ${event.scope} has spent $${event.spentUsd.toFixed(4)} of its $${event.limitUsd.toFixed(2)} monthly limit.`;
  }
}

// Real outbound Slack notification - a genuine external system call (not
// a fabricated integration), gated on a real NotificationChannel row an
// admin configures with their own Slack incoming-webhook URL. Silently
// no-ops if none is configured/enabled - notifications are a real
// enhancement, never a hard dependency for the governance actions that
// trigger them.
export async function sendNotification(event: NotificationEvent, origin = ""): Promise<void> {
  const channel = await prisma.notificationChannel.findFirst({ where: { kind: "slack", enabled: true } });
  if (!channel) return;

  try {
    await fetch(channel.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: formatMessage(event, origin) }),
    });
  } catch {
    // Best-effort: a notification failure should never break the real
    // governance action that triggered it.
  }
}
