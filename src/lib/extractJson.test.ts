import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/extractJson";

describe("extractJson", () => {
  it("parses plain valid JSON", () => {
    expect(extractJson('{"a":1,"b":"two"}')).toEqual({ a: 1, b: "two" });
  });

  it("strips markdown code fences", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("repairs a raw newline inside a string value - the real failure observed live", () => {
    const broken = '{"recommendedPath":"build","rationale":"First sentence.\nSecond sentence."}';
    expect(extractJson(broken)).toEqual({
      recommendedPath: "build",
      rationale: "First sentence.\nSecond sentence.",
    });
  });

  it("repairs a raw tab inside a string value without touching structural whitespace", () => {
    const broken = '{\n  "a": "one\ttwo"\n}';
    expect(extractJson(broken)).toEqual({ a: "one\ttwo" });
  });

  it("leaves already-escaped strings alone", () => {
    expect(extractJson('{"a":"line one\\nline two"}')).toEqual({ a: "line one\nline two" });
  });

  it("still throws on genuinely malformed JSON", () => {
    expect(() => extractJson('{"a": }')).toThrow();
  });
});
