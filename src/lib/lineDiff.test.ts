import { describe, expect, it } from "vitest";
import { diffLines } from "@/lib/lineDiff";

describe("diffLines", () => {
  it("marks every line unchanged when both texts are identical", () => {
    const result = diffLines("a\nb\nc", "a\nb\nc");
    expect(result).toEqual([
      { type: "unchanged", text: "a" },
      { type: "unchanged", text: "b" },
      { type: "unchanged", text: "c" },
    ]);
  });

  it("treats an empty old text as one removed blank line plus added new lines", () => {
    // "".split("\n") yields [""], a single blank line, not zero lines -
    // so the empty old text itself shows up as a removal.
    const result = diffLines("", "a\nb");
    expect(result).toEqual([
      { type: "removed", text: "" },
      { type: "added", text: "a" },
      { type: "added", text: "b" },
    ]);
  });

  it("detects a single changed line in the middle, keeping context unchanged", () => {
    const result = diffLines("one\ntwo\nthree", "one\nTWO\nthree");
    expect(result).toEqual([
      { type: "unchanged", text: "one" },
      { type: "removed", text: "two" },
      { type: "added", text: "TWO" },
      { type: "unchanged", text: "three" },
    ]);
  });

  it("detects a purely appended line at the end", () => {
    const result = diffLines("one\ntwo", "one\ntwo\nthree");
    expect(result).toEqual([
      { type: "unchanged", text: "one" },
      { type: "unchanged", text: "two" },
      { type: "added", text: "three" },
    ]);
  });
});
