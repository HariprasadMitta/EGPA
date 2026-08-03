import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/errorLogging";

export type NotificationEvent =
  | { kind: "arb_approval_needed"; useCaseTitle: string; useCaseId: string }
  | { kind: "execution_failed"; useCaseTitle: string; useCaseId: string; error: string }
  | { kind: "kill_switch_engaged"; useCaseTitle: string; useCaseId: string; actorName: string }
  | { kind: "budget_alert"; scope: string; spentUsd: number; limitUsd: number }
  | { kind: "stale_approval_escalation"; useCaseTitle: string; useCaseId: string; daysPending: number }
  | { kind: "material_change_reapproval"; useCaseTitle: string; useCaseId: string; oldRiskTier: string; newRiskTier: string }
  | { kind: "undeclared_tool_detected"; useCaseTitle: string; useCaseId: string; tools: string[] };

interface NotificationSummary {
  title: string;
  text: string;
  path: string;
}

// Shared, channel-agnostic summary of a real governance event - each
// outbound channel below (Slack, Teams, a generic GRC/ITSM webhook) formats
// this the way its own API expects, but the underlying facts come from one
// place so they can't drift apart between channels.
function summarize(event: NotificationEvent): NotificationSummary {
  switch (event.kind) {
    case "arb_approval_needed":
      return {
        title: "ARB approval needed",
        text: `"${event.useCaseTitle}" is Critical tier and waiting on a named reviewer sign-off.`,
        path: "/gate",
      };
    case "execution_failed":
      return { title: "Execution failed", text: `"${event.useCaseTitle}": ${event.error}`, path: "/execution" };
    case "kill_switch_engaged":
      return {
        title: "Kill switch engaged",
        text: `Engaged on "${event.useCaseTitle}" by ${event.actorName}. The next execution step will be rejected server-side.`,
        path: "/gate",
      };
    case "budget_alert":
      return {
        title: "Budget alert",
        text: `${event.scope} has spent $${event.spentUsd.toFixed(4)} of its $${event.limitUsd.toFixed(2)} monthly limit.`,
        path: "/admin",
      };
    case "stale_approval_escalation":
      return {
        title: "Stale ARB approval",
        text: `"${event.useCaseTitle}" has been waiting on sign-off for ${event.daysPending} day${event.daysPending === 1 ? "" : "s"}. This will keep re-notifying daily until it's resolved.`,
        path: "/gate",
      };
    case "material_change_reapproval":
      return {
        title: "Material change detected",
        text: `"${event.useCaseTitle}" changed risk-relevant inputs (${event.oldRiskTier} → ${event.newRiskTier}) and has been sent back through the governance gate for re-approval.`,
        path: "/gate",
      };
    case "undeclared_tool_detected":
      return {
        title: "Undeclared tool usage reported",
        text: `The production system behind "${event.useCaseTitle}" reported using tool(s) outside its declared, approved stack: ${event.tools.join(", ")}.`,
        path: "/gate",
      };
  }
}

const SLACK_EMOJI: Record<NotificationEvent["kind"], string> = {
  arb_approval_needed: ":warning:",
  execution_failed: ":x:",
  kill_switch_engaged: ":octagonal_sign:",
  budget_alert: ":money_with_wings:",
  stale_approval_escalation: ":rotating_light:",
  material_change_reapproval: ":arrows_counterclockwise:",
  undeclared_tool_detected: ":mag:",
};

function buildSlackPayload(summary: NotificationSummary, kind: NotificationEvent["kind"], origin: string) {
  return { text: `${SLACK_EMOJI[kind]} *${summary.title}* — ${summary.text}\n${origin}${summary.path}` };
}

// Real Teams incoming-webhook payload (the classic Office 365 Connector
// "MessageCard" schema) - a different real JSON shape than Slack's, not
// just Slack's text reformatted, since Teams doesn't understand Slack's
// `:emoji:`/`*bold*` syntax at all.
function buildTeamsPayload(summary: NotificationSummary, origin: string) {
  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    summary: summary.title,
    themeColor: "0A2A43",
    title: summary.title,
    text: `${summary.text}\n\n[Open in Momentum-LOC AI CV](${origin}${summary.path})`,
  };
}

// Real GRC/ITSM integration point: a generic, structured JSON payload (not
// a human-readable sentence) so a customer's own automation - Power
// Automate, a ServiceNow inbound webhook, Jira's webhook-triggered
// automation, or anything else - can parse real fields and route this
// into whatever system of record they actually use, without Momentum-LOC
// needing to integrate with any one vendor's specific API directly.
function buildGenericWebhookPayload(event: NotificationEvent, summary: NotificationSummary, origin: string) {
  return {
    event: event.kind,
    title: summary.title,
    description: summary.text,
    url: `${origin}${summary.path}`,
    occurredAt: new Date().toISOString(),
    ...event,
  };
}

// Real, multi-channel outbound notifications - every enabled channel
// (Slack, Teams, a generic GRC/ITSM webhook) gets every real governance
// event, each formatted for that channel's own real API. Silently no-ops
// if none are configured/enabled - notifications are a real enhancement,
// never a hard dependency for the governance actions that trigger them.
export async function sendNotification(event: NotificationEvent, origin = ""): Promise<void> {
  const channels = await prisma.notificationChannel.findMany({ where: { enabled: true } });
  if (channels.length === 0) return;

  const summary = summarize(event);

  await Promise.all(
    channels.map(async (channel) => {
      const payload =
        channel.kind === "teams"
          ? buildTeamsPayload(summary, origin)
          : channel.kind === "generic-webhook"
            ? buildGenericWebhookPayload(event, summary, origin)
            : buildSlackPayload(summary, event.kind, origin);

      try {
        const res = await fetch(channel.webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          logError("notifications.sendNotification", new Error(`Webhook responded ${res.status}`), {
            kind: event.kind,
            channelKind: channel.kind,
          });
        }
      } catch (err) {
        // Best-effort: a notification failure should never break the real
        // governance action that triggered it - but it should still be
        // visible somewhere real instead of vanishing silently.
        logError("notifications.sendNotification", err, { kind: event.kind, channelKind: channel.kind });
      }
    })
  );
}
