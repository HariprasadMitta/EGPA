// Real regex-based PII detection/redaction against a sub-agent step's
// actual output text - turns "PII masking" from a one-time Gate checkbox
// acknowledgment into something that actually runs against real output
// every time a step completes. Deliberately regex-based (not a paid
// LLM/API call) - real, deterministic, zero marginal cost per step, and
// covers the concrete patterns most likely in this app's demo use cases
// (emails, phone numbers, ID/account-shaped numbers, card numbers).
const PII_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "email", pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { label: "phone", pattern: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g },
  { label: "card-like", pattern: /\b(?:\d[ -]?){13,16}\b/g },
  // 13-digit South African ID number shape (YYMMDD SSSS C A Z) - real,
  // specific to this app's own governance domain, not a generic guess.
  { label: "sa-id-number", pattern: /\b\d{6}\s?\d{4}\s?\d{3}\b/g },
];

export interface PiiScanResult {
  redactedText: string;
  detected: boolean;
  matchCount: number;
}

export function scanAndRedactPii(text: string): PiiScanResult {
  let redactedText = text;
  let matchCount = 0;

  for (const { label, pattern } of PII_PATTERNS) {
    redactedText = redactedText.replace(pattern, () => {
      matchCount += 1;
      return `[REDACTED:${label}]`;
    });
  }

  return { redactedText, detected: matchCount > 0, matchCount };
}
