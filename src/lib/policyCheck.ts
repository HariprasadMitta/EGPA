import { isGateEligible } from "@/lib/governance";

// Same real rules src/lib/executionPersistence.ts already enforces
// preventively for this platform's own execution engine (kill switch, gate
// clearance, tool allowlist, data-sensitivity write-action restriction) -
// factored out so an external production agent can ask the identical
// question in real time, before acting, via the public preflight-check API.
// A single source of truth for "is this allowed" means the external check
// can never quietly drift from what this platform enforces on itself.
const WRITE_ACTION_KEYWORDS = /\b(write|writes|writing|update|updates|updating|delete|deletes|deleting|create|creates|creating|modify|modifies|modifying|change|changes|changing)\b/i;

export interface PolicyCheckContext {
  killSwitchEngaged: boolean;
  gate: { acknowledged: boolean; requiresArbApproval: boolean; arbApproved: boolean } | null;
  declaredTools: string[];
  agentWriteAccessProduction: boolean | null; // null = no Risk & Compliance Profile captured yet
}

export interface PolicyCheckInput {
  tool: string;
  task?: string;
}

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkPolicyAllowed(context: PolicyCheckContext, input: PolicyCheckInput): PolicyCheckResult {
  if (context.killSwitchEngaged) {
    return { allowed: false, reason: "Kill switch is engaged for this use case." };
  }
  if (!isGateEligible(context.gate)) {
    return { allowed: false, reason: "Governance gate is not cleared (acknowledged, and ARB-approved if required)." };
  }
  if (!context.declaredTools.includes(input.tool)) {
    return { allowed: false, reason: `Tool "${input.tool}" is outside the declared, approved tool stack.` };
  }
  if (context.agentWriteAccessProduction === false) {
    const text = `${input.tool} ${input.task ?? ""}`;
    if (WRITE_ACTION_KEYWORDS.test(text)) {
      return {
        allowed: false,
        reason: "This use case declared no production write access, but the request reads as a write action.",
      };
    }
  }
  return { allowed: true };
}
