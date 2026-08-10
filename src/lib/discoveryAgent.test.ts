import { describe, expect, it } from "vitest";
import { findToolCallJson, tryParseToolCall } from "@/lib/discoveryAgent";

describe("tryParseToolCall", () => {
  it("detects a pure JSON tool call (the documented format)", () => {
    const text = '{"tool_call": {"name": "search_existing_use_cases", "query": "expense anomalies"}}';
    expect(tryParseToolCall(text)).toEqual({ query: "expense anomalies" });
  });

  it("detects the tool call even with prose before it - the real failure observed live", () => {
    const text =
      'Having access to the external SQL servers is a good start. Given the frequency, I\'m going to take a look to see if there are any existing solutions or use cases that might address this need.\n{"tool_call": {"name": "search_existing_use_cases", "query": "automated daily vendor invoice data extraction"}}';
    expect(tryParseToolCall(text)).toEqual({ query: "automated daily vendor invoice data extraction" });
  });

  it("detects the tool call with prose after it too", () => {
    const text = '{"tool_call": {"name": "search_existing_use_cases", "query": "ticket routing"}}\nLet me check that for you.';
    expect(tryParseToolCall(text)).toEqual({ query: "ticket routing" });
  });

  it("returns null for a plain conversational reply with no tool call", () => {
    expect(tryParseToolCall("Can you tell me more about the current process?")).toBeNull();
  });

  it("returns null for unrelated JSON-looking text", () => {
    expect(tryParseToolCall('{"something_else": {"a": 1}}')).toBeNull();
  });
});

describe("findToolCallJson", () => {
  it("finds the balanced JSON object regardless of surrounding text", () => {
    const text = 'prefix {"tool_call": {"name": "search_existing_use_cases", "query": "a {nested} brace test"}} suffix';
    const found = findToolCallJson(text);
    expect(found).not.toBeNull();
    expect(() => JSON.parse(found!)).not.toThrow();
  });
});
