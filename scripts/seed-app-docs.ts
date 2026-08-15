// One-off: embed the Help Assistant's own platform guide content into the
// "app-docs" Pinecone namespace so search_app_docs has something real to
// find. Re-run whenever PLATFORM_GUIDE_CONTEXT changes meaningfully -
// upserts by deterministic id, so it's safe to run again (overwrites, no
// duplicates).
import { config } from "dotenv";
config({ path: ".env.local" });
import { chunkText } from "../src/lib/documentParsing";
import { PLATFORM_GUIDE_CONTEXT } from "../src/lib/guideContent";
import { APP_DOCS_NAMESPACE, KB_INDEX_NAME, getDocumentEmbeddings, getPineconeClient } from "../src/lib/knowledgeBase";

async function main() {
  const chunks = chunkText(PLATFORM_GUIDE_CONTEXT);
  console.log(`Chunked platform guide into ${chunks.length} chunks.`);

  const embeddings = getDocumentEmbeddings();
  const vectors = await embeddings.embedDocuments(chunks);

  const index = getPineconeClient().index(KB_INDEX_NAME).namespace(APP_DOCS_NAMESPACE);
  await index.upsert(
    chunks.map((text, i) => ({
      id: `app-docs-chunk-${i}`,
      values: vectors[i],
      metadata: { text, source: "PLATFORM_GUIDE_CONTEXT" },
    }))
  );

  console.log(`Upserted ${chunks.length} vectors into ${KB_INDEX_NAME}/${APP_DOCS_NAMESPACE}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
