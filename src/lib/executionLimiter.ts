import { createRateLimiter } from "@/lib/rateLimit";

// Shared between /api/plan and /api/execute-step so a full execution (1 plan
// call + up to MAX_STEPS step calls) is bounded as a single budget, not two
// independent ones a caller could stack.
export const MAX_STEPS = 4;
export const executionLimiter = createRateLimiter(15, 100);
