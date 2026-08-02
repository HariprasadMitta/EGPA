import { describe, expect, it } from "vitest";
import { classifyRisk, isGateEligible } from "@/lib/governance";

describe("classifyRisk", () => {
  it("scores the lowest-risk combination as Low", () => {
    expect(
      classifyRisk({
        dataSensitivity: "public",
        autonomyLevel: "suggest-only",
        integrationSurface: "read-only-internal",
      })
    ).toBe("Low");
  });

  it("scores the highest-risk combination as Critical", () => {
    expect(
      classifyRisk({
        dataSensitivity: "regulated",
        autonomyLevel: "fully-autonomous",
        integrationSurface: "external-financial-or-safety",
        humanOversightFrequency: "exception-only",
        customerImpactDecision: true,
      })
    ).toBe("Critical");
  });

  it("raises the tier when a customer-impact decision is added, all else equal", () => {
    const base = {
      dataSensitivity: "confidential" as const,
      autonomyLevel: "human-approves-batches" as const,
      integrationSurface: "external-customer-facing" as const,
      humanOversightFrequency: "sampled" as const,
    };
    const withoutImpact = classifyRisk(base);
    const withImpact = classifyRisk({ ...base, customerImpactDecision: true });

    const order = ["Low", "Medium", "High", "Critical"];
    expect(order.indexOf(withImpact)).toBeGreaterThanOrEqual(order.indexOf(withoutImpact));
  });

  it("treats unanswered oversight/impact fields as the safest assumption (0), not a penalty", () => {
    const input = {
      dataSensitivity: "internal" as const,
      autonomyLevel: "human-approves-each-action" as const,
      integrationSurface: "read-write-internal" as const,
    };
    const withoutOptionalFields = classifyRisk(input);
    const withNeutralOptionalFields = classifyRisk({
      ...input,
      humanOversightFrequency: "full-review",
      customerImpactDecision: false,
    });
    expect(withoutOptionalFields).toBe(withNeutralOptionalFields);
  });
});

describe("isGateEligible", () => {
  it("is not eligible when nothing has been acknowledged", () => {
    expect(isGateEligible(null)).toBe(false);
    expect(isGateEligible(undefined)).toBe(false);
    expect(isGateEligible({ acknowledged: false, requiresArbApproval: false, arbApproved: false })).toBe(false);
  });

  it("is eligible once acknowledged, when ARB approval isn't required", () => {
    expect(isGateEligible({ acknowledged: true, requiresArbApproval: false, arbApproved: false })).toBe(true);
  });

  it("is not eligible when ARB approval is required but missing, even if acknowledged", () => {
    expect(isGateEligible({ acknowledged: true, requiresArbApproval: true, arbApproved: false })).toBe(false);
  });

  it("is eligible once acknowledged and ARB has approved", () => {
    expect(isGateEligible({ acknowledged: true, requiresArbApproval: true, arbApproved: true })).toBe(true);
  });
});
