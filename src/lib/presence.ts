import Redis from "ioredis";

export interface PresencePing {
  useCaseId: string;
  userName: string;
  at: number;
}

const CHANNEL = "presence-ping";

// Real live presence - a small, separate real Redis pub/sub channel (same
// pattern as src/lib/eventBus.ts's live-sync broadcast, kept independent so
// a burst of presence pings never competes with real governance-state
// broadcasts on the same channel).
function createClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set.");
  return new Redis(url, { tls: {}, lazyConnect: false });
}

const globalForPresence = globalThis as unknown as {
  presencePublisher?: Redis;
  presenceSubscriber?: Redis;
};

function getPublisher(): Redis {
  globalForPresence.presencePublisher ??= createClient();
  return globalForPresence.presencePublisher;
}

function getSubscriber(): Redis {
  globalForPresence.presenceSubscriber ??= createClient();
  return globalForPresence.presenceSubscriber;
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

export async function publishPresence(ping: PresencePing): Promise<void> {
  await getPublisher().publish(CHANNEL, JSON.stringify(ping));
}

export async function subscribeToPresence(handler: (ping: PresencePing) => void): Promise<() => void> {
  const subscriber = await ensureSubscribed();
  const listener = (channel: string, message: string) => {
    if (channel !== CHANNEL) return;
    try {
      handler(JSON.parse(message) as PresencePing);
    } catch {
      // Skip a malformed ping rather than crash the subscription.
    }
  };
  subscriber.on("message", listener);
  return () => subscriber.off("message", listener);
}
