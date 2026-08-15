import { Pinecone } from "@pinecone-database/pinecone";
import { CohereEmbeddings } from "@langchain/cohere";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const KB_INDEX_NAME = "egpa-knowledge-base";
export const KB_DIMENSION = 1024; // embed-english-v3.0
export const KB_CLOUD = "aws";
export const KB_REGION = "us-east-1";

let pineconeClient: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  }
  return pineconeClient;
}

export function getDocumentEmbeddings(): CohereEmbeddings {
  return new CohereEmbeddings({
    apiKey: process.env.COHERE_API_KEY,
    model: "embed-english-v3.0",
    inputType: "search_document",
  });
}

export function getQueryEmbeddings(): CohereEmbeddings {
  return new CohereEmbeddings({
    apiKey: process.env.COHERE_API_KEY,
    model: "embed-english-v3.0",
    inputType: "search_query",
  });
}

export const knowledgeBaseSearch = tool(
  async ({ query }: { query: string }) => {
    const embeddings = getQueryEmbeddings();
    const vector = await embeddings.embedQuery(query);
    const index = getPineconeClient().index(KB_INDEX_NAME);
    const result = await index.query({ vector, topK: 3, includeMetadata: true });

    if (!result.matches || result.matches.length === 0) {
      return "No relevant documents found in the knowledge base.";
    }

    return result.matches
      .map((m) => `[relevance ${(m.score ?? 0).toFixed(2)}] ${m.metadata?.text ?? ""}`)
      .join("\n\n");
  },
  {
    name: "knowledge_base_search",
    description:
      "Search the internal knowledge base for relevant governance policies, control requirements, or domain reference documents related to a query. Use this when the task would benefit from citing real policy or reference material instead of general knowledge.",
    schema: z.object({
      query: z.string().describe("The search query - what you want to find in the knowledge base."),
    }),
  }
);

// Same index, a separate Pinecone namespace - EGPA's own platform docs
// (see scripts/_seed-app-docs.ts) kept apart from user-uploaded governance
// documents so an admin's KnowledgeBaseDocument upload/delete never touches
// the Help Assistant's own reference material, and vice versa.
export const APP_DOCS_NAMESPACE = "app-docs";

export const searchAppDocs = tool(
  async ({ query }: { query: string }) => {
    const embeddings = getQueryEmbeddings();
    const vector = await embeddings.embedQuery(query);
    const index = getPineconeClient().index(KB_INDEX_NAME).namespace(APP_DOCS_NAMESPACE);
    const result = await index.query({ vector, topK: 3, includeMetadata: true });

    if (!result.matches || result.matches.length === 0) {
      return "No relevant EGPA documentation found for that query.";
    }

    return result.matches
      .map((m) => `[relevance ${(m.score ?? 0).toFixed(2)}] ${m.metadata?.text ?? ""}`)
      .join("\n\n");
  },
  {
    name: "search_app_docs",
    description:
      "Search EGPA's own platform documentation - page-by-page behavior, roles, and governance concepts - for real, current help content relevant to a user's question about how to use the app.",
    schema: z.object({
      query: z.string().describe("What the user wants help understanding about the app."),
    }),
  }
);
