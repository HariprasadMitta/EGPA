export interface CuratedModel {
  id: string;
  label: string;
  description: string;
}

// Free-tier OpenRouter models (":free" suffix). Availability shifts over
// time - verify live on first connect and prune/replace entries that no
// longer respond, same spirit as modelRegistry.ts's curated static lists.
export const OPENROUTER_FREE_MODELS: CuratedModel[] = [
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    label: "Llama 3.3 70B Instruct (free)",
    description: "Meta's general-purpose instruct model, served free via OpenRouter.",
  },
  {
    id: "google/gemini-2.0-flash-exp:free",
    label: "Gemini 2.0 Flash Experimental (free)",
    description: "Google's fast experimental model, served free via OpenRouter.",
  },
  {
    id: "deepseek/deepseek-chat-v3-0324:free",
    label: "DeepSeek Chat v3 (free)",
    description: "DeepSeek's chat model, served free via OpenRouter.",
  },
];

// Small Hugging Face serverless Inference API models. Also shifts over
// time - the HF free tier periodically retires/cold-starts models.
export const HUGGINGFACE_TEXT_MODELS: CuratedModel[] = [
  {
    id: "HuggingFaceH4/zephyr-7b-beta",
    label: "Zephyr 7B Beta",
    description: "Small instruct-tuned model, commonly available on HF's free Inference API.",
  },
  {
    id: "mistralai/Mistral-7B-Instruct-v0.2",
    label: "Mistral 7B Instruct v0.2",
    description: "Popular small instruct model, commonly available on HF's free Inference API.",
  },
];

export const HUGGINGFACE_EMBEDDING_MODEL: CuratedModel = {
  id: "sentence-transformers/all-MiniLM-L6-v2",
  label: "all-MiniLM-L6-v2",
  description: "Small, fast sentence-embedding model used for the RAG demo.",
};
