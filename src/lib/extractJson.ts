// Shared, hardened JSON extraction for every "ask the LLM for a JSON
// object" call in this app (recommend, Discovery Advisor finalize, and
// any future one). Plain JSON.parse alone breaks on a real, observed
// failure mode: a smaller model (this Gateway's egpa-primary is
// openrouter/meta-llama/llama-3.3-70b-instruct) sometimes emits a raw,
// literal newline/tab inside a JSON string value instead of the escaped
// "\n" - technically invalid JSON, but a mechanical, fixable mistake, not
// a shape problem. Confirmed live: this exact error ("Expected ',' or '}'
// after property value") hit Discovery Advisor's finalize step in
// production once the real Gateway was wired up.
function escapeRawControlCharsInStrings(text: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (const char of text) {
    if (inString) {
      if (escaped) {
        result += char;
        escaped = false;
        continue;
      }
      if (char === "\\") {
        result += char;
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
        result += char;
        continue;
      }
      if (char === "\n") {
        result += "\\n";
        continue;
      }
      if (char === "\r") {
        result += "\\r";
        continue;
      }
      if (char === "\t") {
        result += "\\t";
        continue;
      }
      result += char;
      continue;
    }
    if (char === '"') inString = true;
    result += char;
  }
  return result;
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(escapeRawControlCharsInStrings(candidate));
  }
}
