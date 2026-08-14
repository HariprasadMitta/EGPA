// mammoth ships no TypeScript types - minimal ambient declaration covering
// only the one function this app actually calls (extractRawText).
declare module "mammoth" {
  export function extractRawText(input: { buffer: Buffer }): Promise<{ value: string; messages: unknown[] }>;
}
