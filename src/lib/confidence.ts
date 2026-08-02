// Real heuristic confidence score (0-1) computed from a sub-agent step's
// actual output text - not an extra paid LLM-as-judge call. Cheap, real,
// and deterministic: penalizes hedge language and very short/generic
// output, rewards concrete, specific-looking output (numbers, named
// entities, cited facts). Most useful on Critical-tier "manual HITL on
// every action" steps, where the human reviewer needs something concrete
// to weigh, not just prose.
const HEDGE_PHRASES = [
  "i think",
  "i believe",
  "might be",
  "could be",
  "possibly",
  "perhaps",
  "not sure",
  "unclear",
  "i'm not certain",
  "may not",
  "it seems",
  "appears to",
];

export function computeConfidenceScore(output: string): number {
  const text = output.trim();
  if (!text) return 0;

  const lower = text.toLowerCase();
  let score = 0.7; // real baseline for a non-empty, well-formed response

  const hedgeCount = HEDGE_PHRASES.reduce((count, phrase) => count + (lower.includes(phrase) ? 1 : 0), 0);
  score -= hedgeCount * 0.1;

  // Very short output reads as under-specified for most governed tasks.
  if (text.length < 40) score -= 0.2;

  // Concrete signals: digits (real figures/dates/amounts) and capitalized
  // multi-word sequences (named entities/specific systems) both push
  // toward "this cites something real" rather than generic filler.
  const hasDigits = /\d/.test(text);
  const hasProperNouns = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/.test(text);
  if (hasDigits) score += 0.1;
  if (hasProperNouns) score += 0.1;

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}
