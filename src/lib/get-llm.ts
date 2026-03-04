import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

/**
 * Returns the appropriate LLM based on environment:
 * - USE_LOCAL_AI=true → ChatOllama (local, offline)
 * - Otherwise + OPENAI_API_KEY → ChatOpenAI (cloud)
 */
export function getLLM(): BaseChatModel {
  const useLocal = process.env.USE_LOCAL_AI === "true";
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2:3b";

  if (useLocal) {
    return new ChatOllama({
      baseUrl: ollamaBaseUrl,
      model: ollamaModel,
      temperature: 0.2,
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "AI service not configured. Set OPENAI_API_KEY or USE_LOCAL_AI=true with Ollama running."
    );
  }

  return new ChatOpenAI({
    model: "gpt-4-turbo",
    temperature: 0.2,
  });
}

export function isLocalAIEnabled(): boolean {
  return process.env.USE_LOCAL_AI === "true";
}

export function hasAIConfigured(): boolean {
  return (
    process.env.USE_LOCAL_AI === "true" || !!process.env.OPENAI_API_KEY
  );
}
