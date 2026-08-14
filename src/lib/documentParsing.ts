// Real text extraction for admin knowledge-base uploads - no OCR, no
// scanned-image support, just the same "get plain text out of a real
// office document" job mammoth/pdf-parse already do well.
export type DocumentSourceType = "pdf" | "docx" | "text";

export function sourceTypeFor(filename: string, mimeType: string): DocumentSourceType | null {
  const lower = filename.toLowerCase();
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    return "docx";
  }
  if (mimeType.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".md")) return "text";
  return null;
}

export async function extractText(buffer: Buffer, sourceType: DocumentSourceType): Promise<string> {
  if (sourceType === "text") return buffer.toString("utf-8");
  if (sourceType === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  // pdf
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

// Paragraph-first chunking: keeps whole paragraphs together up to a target
// size instead of a fixed character cutoff, so a chunk doesn't get sliced
// mid-sentence - real embeddings read better on coherent text. Falls back
// to a hard split only for a single paragraph that's already too long.
const TARGET_CHUNK_CHARS = 1200;
const MAX_CHUNK_CHARS = 1800;

export function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > MAX_CHUNK_CHARS) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < paragraph.length; i += TARGET_CHUNK_CHARS) {
        chunks.push(paragraph.slice(i, i + TARGET_CHUNK_CHARS));
      }
      continue;
    }
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > TARGET_CHUNK_CHARS && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}
