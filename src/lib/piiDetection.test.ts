import { describe, expect, it } from "vitest";
import { scanAndRedactPii } from "@/lib/piiDetection";

describe("scanAndRedactPii", () => {
  it("reports no detection on plain text", () => {
    const result = scanAndRedactPii("The agent classified the ticket as high priority.");
    expect(result.detected).toBe(false);
    expect(result.matchCount).toBe(0);
    expect(result.redactedText).toBe("The agent classified the ticket as high priority.");
  });

  it("redacts an email address", () => {
    const result = scanAndRedactPii("Contact the customer at jane.doe@example.com for follow-up.");
    expect(result.detected).toBe(true);
    expect(result.redactedText).toContain("[REDACTED:email]");
    expect(result.redactedText).not.toContain("jane.doe@example.com");
  });

  it("redacts a South African ID number shape", () => {
    const result = scanAndRedactPii("ID number on file: 8501015009087.");
    expect(result.detected).toBe(true);
    expect(result.redactedText).toContain("[REDACTED:");
  });

  it("counts multiple distinct matches", () => {
    const result = scanAndRedactPii("Reach jane@example.com or john@example.com for details.");
    expect(result.matchCount).toBe(2);
  });
});
