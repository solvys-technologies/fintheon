// [codex 2026-05-23] Removed local subscription gateway routing.
// Strands agents now use DeepSeek direct, the local Hermes/OpenCode API, or
// the Ollama fallback.
import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import { createLogger } from "../../lib/logger.js";
import {
  getOllamaBaseUrl,
  getOllamaModel,
  isOllamaFallbackEnabled,
} from "../ai/ollama-hermes-client.js";
import {
  checkDeepSeekDirectHealth,
  checkDeepSeekOcApiHealth,
} from "./deepseek-health.js";

export { checkDeepSeekDirectHealth, checkDeepSeekOcApiHealth };

const log = createLogger("StrandsProvider");

const DEEPSEEK_MODEL = "deepseek-reasoner";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const HERMES_API_BASE_URL = "http://localhost:8081/v1";

export interface StrandsModelOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

function normalizeUrl(raw: string): string {
  const stripped = raw.replace(/\/+$/, "");
  return stripped.endsWith("/v1") ? stripped : `${stripped}/v1`;
}

function getDeepSeekDirectBaseUrl(): string {
  const raw = process.env.DEEPSEEK_API_BASE_URL || DEEPSEEK_BASE_URL;
  return normalizeUrl(raw);
}

function getOpenCodeGoBaseUrl(): string {
  const raw =
    process.env.OPENCODE_GO_API_URL ||
    process.env.HERMES_API_URL ||
    HERMES_API_BASE_URL;
  return normalizeUrl(raw);
}

export function createDeepSeekDirectModel(
  options?: StrandsModelOptions,
  overrideApiKey?: string | null,
): OpenAIModel {
  const apiKey = overrideApiKey || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");
  return new OpenAIModel({
    api: "chat",
    apiKey,
    clientConfig: { baseURL: getDeepSeekDirectBaseUrl() },
    modelId: options?.model || DEEPSEEK_MODEL,
    temperature: options?.temperature ?? 0.3,
    maxTokens: options?.maxTokens ?? 8192,
  });
}

export function createDeepSeekOcApiModel(
  options?: StrandsModelOptions,
  overrideApiKey?: string | null,
): OpenAIModel {
  const apiKey =
    overrideApiKey ||
    process.env.OPENCODE_GO_API_KEY ||
    process.env.HERMES_API_KEY ||
    "opencode-go";
  return new OpenAIModel({
    api: "chat",
    apiKey,
    clientConfig: { baseURL: getOpenCodeGoBaseUrl() },
    modelId: options?.model || DEEPSEEK_MODEL,
    temperature: options?.temperature ?? 0.3,
    maxTokens: options?.maxTokens ?? 8192,
  });
}

export function createOllamaFallbackModel(
  options?: StrandsModelOptions,
): OpenAIModel {
  const baseUrl = getOllamaBaseUrl();
  const modelId = options?.model || getOllamaModel();
  log.info("Creating Ollama-Qwen fallback model", { modelId, baseUrl });
  return new OpenAIModel({
    api: "chat",
    apiKey: process.env.OLLAMA_API_KEY || "ollama",
    clientConfig: { baseURL: `${baseUrl}/v1` },
    modelId,
    temperature: options?.temperature ?? 0.4,
    maxTokens: options?.maxTokens ?? 8192,
  });
}

export async function createChainModel(options?: StrandsModelOptions): Promise<{
  model: OpenAIModel;
  provider: "deepseek-direct" | "deepseek-oc-api" | "ollama-qwen";
}> {
  const direct = await checkDeepSeekDirectHealth().catch((err) => ({
    available: false,
    error: err instanceof Error ? err.message : String(err),
  }));
  if (direct.available) {
    return {
      model: createDeepSeekDirectModel(options),
      provider: "deepseek-direct",
    };
  }

  const hermes = await checkDeepSeekOcApiHealth().catch((err) => ({
    available: false,
    error: err instanceof Error ? err.message : String(err),
  }));
  if (hermes.available) {
    return {
      model: createDeepSeekOcApiModel(options),
      provider: "deepseek-oc-api",
    };
  }

  if (isOllamaFallbackEnabled()) {
    return {
      model: createOllamaFallbackModel(options),
      provider: "ollama-qwen",
    };
  }

  throw new Error(
    `No Strands AI provider available: DeepSeek direct (${direct.error ?? "unavailable"}), Hermes API (${hermes.error ?? "unavailable"}), Ollama fallback disabled`,
  );
}
