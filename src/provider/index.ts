import { createOllamaProvider, type LlmProvider } from "./ollama.js";

export type { LlmProvider, ChatRequest } from "./ollama.js";

export async function getProvider(): Promise<LlmProvider> {
  const name = (process.env.LLM_PROVIDER ?? "ollama").toLowerCase();
  switch (name) {
    case "ollama":
      return createOllamaProvider();
    default:
      throw new Error(
        `Unknown LLM_PROVIDER="${name}". Supported: ollama (cloud adapters come later).`,
      );
  }
}
