import { createRateLimiter } from "@/lib/rateLimit";

// Shared between /api/plan and /api/execute-step so a full execution (1 plan
// call + up to MAX_STEPS step calls) is bounded as a single budget, not two
// independent ones a caller could stack.
export const MAX_STEPS = 4;
export const executionLimiter = createRateLimiter(15, 100);

// Separate budget for the webhook trigger route, keyed by useCaseId instead
// of caller IP - real LLM calls cost real money and nothing human is in the
// loop to notice a runaway automated trigger.
export const triggerLimiter = createRateLimiter(10, 100);
