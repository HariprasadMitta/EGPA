import Redis from "ioredis";
import { UseCaseBundle } from "@/types";
import { logError } from "@/lib/errorLogging";

export interface UseCaseUpdateEvent {
  useCaseId: string;
  bundle: UseCaseBundle;
}

const CHANNEL = "use-case-update";

// Org-wide, real-time "a real request of this kind just happened" signal -
// powers ArchitectureDiagramWidget.tsx's live highlighting. Deliberately
// carries nothing but the flow id (no request payload, no user identity) -
// it's a presence/activity pulse, not an audit log.
export type ArchitectureFlow =
  | "discovery"
  | "recommendation"
  | "gate"
  | "execute"
  | "governance"
  | "admin"
  | "help"
  | "evidence";

// `phase` carries the real sub-step for flows with genuine multi-phase
// internals (Discovery's thinking/tool_call/tool_result/done, Agentic
// System's node/tool_call/tool_result/model/usage_delta/done) - the exact
// same vocabulary those pages' own SSE streams already use (see
// DiscoveryTurnEvent/StepEvent), just re-published on this channel too so
// the org-wide widget can show each real action, not one blob per request.
// Absent for single-shot flows (gate, admin, evidence, ...) that have no
// meaningful sub-steps to report.
//
// `detail` carries the real specific behind that phase - which tool was
// actually called (toolName), which model actually answered (provider), or
// the actual error text - not just the generic phase name. Absent when a
// phase has no extra specific worth showing (thinking, done).
export interface FlowActivityEvent {
  flow: ArchitectureFlow;
  phase?: string;
  detail?: string;
}

const ACTIVITY_CHANNEL = "architecture-flow-activity";

// Real Redis pub/sub (Upstash) - replaces the in-memory EventEmitter this
// module used before Phase 9. A publish from one serverless invocation now
// genuinely reaches a subscribe running in a different invocation/instance,
// which Vercel uses routinely and an in-memory EventEmitter never could.
// Two dedicated connections per process (a subscriber connection can't also
// run other Redis commands), cached on globalThis the same way
// src/lib/prisma.ts avoids exhausting connections across Turbopack
// hot-reloads.
function createClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set.");
  return new Redis(url, { tls: {}, lazyConnect: false });
}

const globalForRedis = globalThis as unknown as {
  redisPublisher?: Redis;
  redisSubscriber?: Redis;
};

function getPublisher(): Redis {
  globalForRedis.redisPublisher ??= createClient();
  return globalForRedis.redisPublisher;
}

function getSubscriber(): Redis {
  globalForRedis.redisSubscriber ??= createClient();
  return globalForRedis.redisSubscriber;
}

// Generalized over channel name (was single-channel/single-bool before the
// activity channel existed) - multiple channels share the one subscriber
// connection ioredis requires, each caller's "message" listener filters to
// its own channel the same way it always did.
const subscribedChannels = new Set<string>();
async function ensureSubscribed(channel: string): Promise<Redis> {
  const subscriber = getSubscriber();
  if (!subscribedChannels.has(channel)) {
    await subscriber.subscribe(channel);
    subscribedChannels.add(channel);
  }
  return subscriber;
}

export async function publishUseCaseUpdate(event: UseCaseUpdateEvent): Promise<void> {
  await getPublisher().publish(CHANNEL, JSON.stringify(event));
}

// Multiple SSE connections in the same process share one Redis subscriber
// connection (each registers its own "message" listener) - only the shared
// channel subscription is set up once; each caller's own listener is
// removed independently on unsubscribe, exactly mirroring the old
// EventEmitter's per-listener semantics.
export async function subscribeToUseCaseUpdates(
  handler: (event: UseCaseUpdateEvent) => void
): Promise<() => void> {
  const subscriber = await ensureSubscribed(CHANNEL);
  const listener = (channel: string, message: string) => {
    if (channel !== CHANNEL) return;
    try {
      handler(JSON.parse(message) as UseCaseUpdateEvent);
    } catch (err) {
      // Skip a malformed message rather than crash the subscription - but
      // this should never actually happen (we control both ends), so it's
      // worth knowing about if it ever does.
      logError("eventBus.subscribeToUseCaseUpdates", err);
    }
  };
  subscriber.on("message", listener);
  return () => subscriber.off("message", listener);
}

// Fire-and-forget on purpose - a route's real work (a chat turn, a gate
// action, an agent step) must never fail or slow down because the activity
// pulse couldn't publish. Errors are logged, never thrown.
export function publishFlowActivity(flow: ArchitectureFlow, phase?: string, detail?: string): void {
  getPublisher()
    .publish(ACTIVITY_CHANNEL, JSON.stringify({ flow, phase, detail } satisfies FlowActivityEvent))
    .catch((err) => logError("eventBus.publishFlowActivity", err));
}

export async function subscribeToFlowActivity(
  handler: (event: FlowActivityEvent) => void
): Promise<() => void> {
  const subscriber = await ensureSubscribed(ACTIVITY_CHANNEL);
  const listener = (channel: string, message: string) => {
    if (channel !== ACTIVITY_CHANNEL) return;
    try {
      handler(JSON.parse(message) as FlowActivityEvent);
    } catch (err) {
      logError("eventBus.subscribeToFlowActivity", err);
    }
  };
  subscriber.on("message", listener);
  return () => subscriber.off("message", listener);
}
