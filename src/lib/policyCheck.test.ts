import { describe, expect, it } from "vitest";
import { checkPolicyAllowed, PolicyCheckContext } from "@/lib/policyCheck";

const baseContext: PolicyCheckContext = {
  killSwitchEngaged: false,
  gate: { acknowledged: true, requiresArbApproval: false, arbApproved: false },
  declaredTools: ["Internal Data Platform MCP server", "GitHub MCP server"],
  agentWriteAccessProduction: null,
};

describe("checkPolicyAllowed", () => {
  it("allows a declared tool when the gate is clear and the kill switch is off", () => {
    const result = checkPolicyAllowed(baseContext, { tool: "Internal Data Platform MCP server" });
    expect(result.allowed).toBe(true);
  });

  it("blocks when the kill switch is engaged, even for a declared tool", () => {
    const result = checkPolicyAllowed(
      { ...baseContext, killSwitchEngaged: true },
      { tool: "Internal Data Platform MCP server" }
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/kill switch/i);
  });

  it("blocks when the governance gate isn't cleared", () => {
    const result = checkPolicyAllowed(
      { ...baseContext, gate: { acknowledged: false, requiresArbApproval: false, arbApproved: false } },
      { tool: "Internal Data Platform MCP server" }
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/gate/i);
  });

  it("blocks when ARB approval is required but missing, even if acknowledged", () => {
    const result = checkPolicyAllowed(
      { ...baseContext, gate: { acknowledged: true, requiresArbApproval: true, arbApproved: false } },
      { tool: "Internal Data Platform MCP server" }
    );
    expect(result.allowed).toBe(false);
  });

  it("blocks a tool outside the declared, approved stack", () => {
    const result = checkPolicyAllowed(baseContext, { tool: "Production Database Direct Write" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/outside the declared/i);
  });

  it("blocks a write-shaped request when write access to production was declared false", () => {
    const result = checkPolicyAllowed(
      { ...baseContext, agentWriteAccessProduction: false },
      { tool: "GitHub MCP server", task: "update the production deployment config" }
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/write access/i);
  });

  it("allows a non-write-shaped request when write access to production was declared false", () => {
    const result = checkPolicyAllowed(
      { ...baseContext, agentWriteAccessProduction: false },
      { tool: "GitHub MCP server", task: "read the current deployment status" }
    );
    expect(result.allowed).toBe(true);
  });

  it("doesn't apply the write-action restriction when write access is declared true", () => {
    const result = checkPolicyAllowed(
      { ...baseContext, agentWriteAccessProduction: true },
      { tool: "GitHub MCP server", task: "update the production deployment config" }
    );
    expect(result.allowed).toBe(true);
  });
});
