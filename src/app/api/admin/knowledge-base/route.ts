import { randomUUID } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publishFlowActivity } from "@/lib/eventBus";
import { getPineconeClient, getDocumentEmbeddings, KB_INDEX_NAME } from "@/lib/knowledgeBase";
import { sourceTypeFor, extractText, chunkText } from "@/lib/documentParsing";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

function chunkId(documentId: string, index: number): string {
  return `${documentId}-chunk-${index}`;
}

// Real admin path to add governance documents to the same Pinecone index
// knowledge_base_search (src/lib/knowledgeBase.ts) reads from - previously
// the only way to add anything was the hand-run
// scripts/ingest-knowledge-base.ts script. Embeds and upserts BEFORE
// creating the DB record, so a failed embed/upsert never leaves an
// orphaned document row with no real vectors behind it.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can manage the knowledge base." }, { status: 403 });
  }

  const documents = await prisma.knowledgeBaseDocument.findMany({ orderBy: { createdAt: "desc" } });
  return Response.json({ documents });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can add knowledge base documents." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data with a file field." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "The uploaded file is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ error: "File is too large - the limit is 15 MB." }, { status: 400 });
  }

  const sourceType = sourceTypeFor(file.name, file.type);
  if (!sourceType) {
    return Response.json({ error: "Only .pdf, .docx, .txt, and .md files are supported." }, { status: 400 });
  }

  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    text = await extractText(buffer, sourceType);
  } catch (err) {
    return Response.json({ error: `Could not read this file: ${(err as Error).message}` }, { status: 400 });
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return Response.json({ error: "No extractable text found in this file." }, { status: 400 });
  }

  const documentId = randomUUID();
  try {
    const embeddings = getDocumentEmbeddings();
    const vectors = await embeddings.embedDocuments(chunks);

    const index = getPineconeClient().index(KB_INDEX_NAME);
    await index.upsert(
      chunks.map((chunkContent, i) => ({
        id: chunkId(documentId, i),
        values: vectors[i],
        metadata: { text: chunkContent, documentId, filename: file.name },
      }))
    );
  } catch (err) {
    return Response.json({ error: `Embedding/upsert failed: ${(err as Error).message}` }, { status: 502 });
  }

  const document = await prisma.knowledgeBaseDocument.create({
    data: {
      id: documentId,
      filename: file.name,
      sourceType,
      sizeBytes: file.size,
      chunkCount: chunks.length,
      uploadedByUserId: session.user.id,
      uploadedByName: session.user.name,
    },
  });

  publishFlowActivity("admin", "knowledge_base_upload", file.name);

  return Response.json({ document });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin") {
    return Response.json({ error: "Only Admin can remove knowledge base documents." }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id is required." }, { status: 400 });

  const document = await prisma.knowledgeBaseDocument.findUnique({ where: { id } });
  if (!document) return Response.json({ error: "Document not found." }, { status: 404 });

  const ids = Array.from({ length: document.chunkCount }, (_, i) => chunkId(document.id, i));
  try {
    const index = getPineconeClient().index(KB_INDEX_NAME);
    if (ids.length > 0) await index.deleteMany(ids);
  } catch (err) {
    return Response.json({ error: `Failed to remove vectors from Pinecone: ${(err as Error).message}` }, { status: 502 });
  }

  await prisma.knowledgeBaseDocument.delete({ where: { id } });
  publishFlowActivity("admin", "knowledge_base_delete", document.filename);

  return Response.json({ ok: true });
}
