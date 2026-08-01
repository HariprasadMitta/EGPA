import Redis from "ioredis";
import { UseCaseBundle } from "@/types";

export interface UseCaseUpdateEvent {
  useCaseId: string;
  bundle: UseCaseBundle;
}

const CHANNEL = "use-case-update";

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

let subscribed = false;
async function ensureSubscribed(): Promise<Redis> {
  const subscriber = getSubscriber();
  if (!subscribed) {
    await subscriber.subscribe(CHANNEL);
    subscribed = true;
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
  const subscriber = await ensureSubscribed();
  const listener = (channel: string, message: string) => {
    if (channel !== CHANNEL) return;
    try {
      handler(JSON.parse(message) as UseCaseUpdateEvent);
    } catch {
      // Skip a malformed message rather than crash the subscription.
    }
  };
  subscriber.on("message", listener);
  return () => subscriber.off("message", listener);
}
