import { Pinecone } from "@pinecone-database/pinecone";
import { CohereEmbeddings } from "@langchain/cohere";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const KB_INDEX_NAME = "momentum-knowledge-base";
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
