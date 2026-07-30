import type { ChatMessage } from "../types.js";

export type ChatRequest = {
  messages: ChatMessage[];
  format: Record<string, unknown>;
  temperature?: number;
  model?: string;
};

export type LlmProvider = {
  name: string;
  chat: (request: ChatRequest) => Promise<string>;
  healthCheck: () => Promise<void>;
};

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export async function createOllamaProvider(): Promise<LlmProvider> {
  const host = env("OLLAMA_HOST", "http://127.0.0.1:11434").replace(/\/$/, "");
  const defaultModel = env("OLLAMA_MODEL", "qwen2.5:3b");

  async function chat(request: ChatRequest): Promise<string> {
    const model = request.model ?? defaultModel;
    const response = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: false,
        format: request.format,
        options: {
          temperature: request.temperature ?? 0,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Ollama /api/chat failed (${response.status}): ${body.slice(0, 500)}`,
      );
    }

    const payload = (await response.json()) as {
      message?: { content?: string };
    };
    const content = payload.message?.content;
    if (typeof content !== "string") {
      throw new Error("Ollama response missing message.content");
    }
    return content;
  }

  async function healthCheck(): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${host}/api/tags`);
    } catch (err) {
      throw new Error(
        `Ollama unreachable at ${host}. Start it with: docker compose up -d\n${String(err)}`,
      );
    }
    if (!response.ok) {
      throw new Error(`Ollama health check failed (${response.status}) at ${host}`);
    }
  }

  return { name: "ollama", chat, healthCheck };
}
