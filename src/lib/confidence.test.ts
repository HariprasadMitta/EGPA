import { describe, expect, it } from "vitest";
import { computeConfidenceScore } from "@/lib/confidence";

describe("computeConfidenceScore", () => {
  it("scores empty output at 0", () => {
    expect(computeConfidenceScore("")).toBe(0);
    expect(computeConfidenceScore("   ")).toBe(0);
  });

  it("penalizes hedge language relative to an equally long, unhedged sentence", () => {
    const hedged = computeConfidenceScore(
      "I think the output might be correct, but I'm not sure and it could be wrong."
    );
    const confident =
      computeConfidenceScore("The output is correct, verified against the source record directly.");
    expect(hedged).toBeLessThan(confident);
  });

  it("rewards concrete signals like digits and proper nouns over generic short output", () => {
    const concrete = computeConfidenceScore(
      "Flagged Invoice 4021 from Acme Corp for a $1,200 variance against the Q3 budget baseline."
    );
    const generic = computeConfidenceScore("Looks fine.");
    expect(concrete).toBeGreaterThan(generic);
  });

  it("always stays within [0, 1]", () => {
    const score = computeConfidenceScore(
      "I think it might possibly be unclear, perhaps it could be wrong, it seems not sure at all."
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
