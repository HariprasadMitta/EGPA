import { EventEmitter } from "events";
import { UseCaseBundle } from "@/types";

export interface UseCaseUpdateEvent {
  useCaseId: string;
  bundle: UseCaseBundle;
}

// In-memory only: resets on cold start/per-instance, same accepted
// tradeoff already documented in rateLimit.ts for this unmonitored demo -
// a real multi-instance deployment would need a real pub/sub backend
// (Redis, etc.) instead of a module-level EventEmitter.
const bus = new EventEmitter();
bus.setMaxListeners(0); // unbounded - every connected browser tab subscribes

const EVENT_NAME = "use-case-update";

export function publishUseCaseUpdate(event: UseCaseUpdateEvent) {
  bus.emit(EVENT_NAME, event);
}

export function subscribeToUseCaseUpdates(handler: (event: UseCaseUpdateEvent) => void): () => void {
  bus.on(EVENT_NAME, handler);
  return () => bus.off(EVENT_NAME, handler);
}
