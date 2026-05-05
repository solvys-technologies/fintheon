// [claude-code 2026-05-03] S58-T1: DeepSeek v4 Pro primary provider migration
// [claude-code 2026-04-23] S32-T3 Ollama fallback chain — createOllamaFallbackModel + chain-aware helpers
// [claude-code 2026-04-10] Round-robin across multiple VProxy endpoints via VPROXY_URLS env var
// [claude-code 2026-04-04] Strands SDK VProxy model provider — OpenAI-compatible endpoint at localhost:8317
import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import { createLogger } from "../../lib/logger.js";
import {
  getOllamaBaseUrl,
  getOllamaModel,
  isOllamaFallbackEnabled,
} from "../ai/ollama-hermes-client.js";

export {
  checkDeepSeekDirectHealth,
  checkDeepSeekOcApiHealth,
} from "./deepseek-health.js";

const log = createLogger("StrandsVProxy");

const DEFAULT_BASE_URL = "http://localhost:8317";
const DEFAULT_MODEL = "claude-opus-4-6";
const DEFAULT_API_KEY = "CLI_PROXY_API_KEY";
const DEEPSEEK_MODEL = "deepseek-reasoner";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const OC_API_BASE_URL = "http://localhost:8317/v1";
const HEALTH_CACHE_TTL_MS = 15_000;

export interface VProxyModelOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// Per-endpoint health cache for round-robin
const healthCacheMap = new Map<
  string,
  { available: boolean; checkedAt: number; error: string | null }
>();
// Module-level round-robin counter — shared across all requests
let rrCounter = 0;

/** Parse VPROXY_URLS (comma-separated) or fall back to VPROXY_BASE_URL */
function getVProxyUrls(): string[] {
  const multi = process.env.VPROXY_URLS;
  if (multi) {
    const parsed = multi
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
    if (parsed.length > 0) return parsed;
  }
  return [process.env.VPROXY_BASE_URL || DEFAULT_BASE_URL];
}

function normalizeUrl(raw: string): string {
  const stripped = raw.replace(/\/+$/, "");
  return stripped.endsWith("/v1") ? stripped : `${stripped}/v1`;
}

/** Get next VProxy base URL using round-robin across all configured endpoints */
export function getNextBaseUrl(): string {
  const urls = getVProxyUrls();
  if (urls.length === 1) return normalizeUrl(urls[0]);
  const idx = rrCounter % urls.length;
  rrCounter++;
  log.info("VProxy round-robin", { idx, total: urls.length, url: urls[idx] });
  return normalizeUrl(urls[idx]);
}

/** Normalize model ID: dots → hyphens (VProxy rejects dots with 502) */
function resolveModel(modelOverride?: string): string {
  const configured =
    modelOverride || process.env.VPROXY_ANTHROPIC_MODEL || DEFAULT_MODEL;
  let model = configured;
  if (model.startsWith("anthropic/")) model = model.slice("anthropic/".length);
  if (model === "opus")
    model = process.env.VPROXY_ANTHROPIC_MODEL || DEFAULT_MODEL;
  model = model.replace(/(\d+)\.(\d+)/g, "$1-$2");
  return model;
}

function getBaseUrl(): string {
  return getNextBaseUrl();
}

function getApiKey(): string {
  return process.env.VPROXY_API_KEY || DEFAULT_API_KEY;
}

function getDeepSeekDirectBaseUrl(): string {
  const raw = process.env.DEEPSEEK_API_BASE_URL || DEEPSEEK_BASE_URL;
  return normalizeUrl(raw);
}

function getOpenCodeGoBaseUrl(): string {
  const raw = process.env.OPENCODE_GO_API_URL || process.env.HERMES_API_URL || OC_API_BASE_URL;
  return normalizeUrl(raw);
}

/** Create a Strands OpenAIModel pointing at VProxy */
export function createVProxyModel(options?: VProxyModelOptions): OpenAIModel {
  const modelId = resolveModel(options?.model);
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();

  log.info("Creating VProxy model", { modelId, baseUrl });

  return new OpenAIModel({
    api: "chat",
    apiKey,
    clientConfig: {
      baseURL: baseUrl,
    },
    modelId,
    temperature: options?.temperature ?? 0.4,
    maxTokens: options?.maxTokens ?? 8192,
  });
}

export function createDeepSeekDirectModel(
  options?: VProxyModelOptions,
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
  options?: VProxyModelOptions,
  overrideApiKey?: string | null,
): OpenAIModel {
  const apiKey = overrideApiKey || process.env.OPENCODE_GO_API_KEY || process.env.HERMES_API_KEY || "opencode-go";
  return new OpenAIModel({
    api: "chat",
    apiKey,
    clientConfig: { baseURL: getOpenCodeGoBaseUrl() },
    modelId: options?.model || DEEPSEEK_MODEL,
    temperature: options?.temperature ?? 0.3,
    maxTokens: options?.maxTokens ?? 8192,
  });
}

async function checkSingleEndpoint(
  baseUrl: string,
  force: boolean,
): Promise<{ available: boolean; error: string | null }> {
  const cached = healthCacheMap.get(baseUrl);
  if (!force && cached && Date.now() - cached.checkedAt < HEALTH_CACHE_TTL_MS) {
    return cached;
  }

  const apiKey = getApiKey();
  let result: { available: boolean; checkedAt: number; error: string | null };

  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `models endpoint returned ${response.status}: ${text.slice(0, 160)}`,
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{ id?: string }>;
    };
    const hasClaude = (payload.data ?? []).some((entry) =>
      (entry.id ?? "").includes("claude"),
    );
    if (!hasClaude) throw new Error("no Claude models reported by VProxy");

    result = { available: true, checkedAt: Date.now(), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result = { available: false, checkedAt: Date.now(), error: message };
    log.warn("VProxy endpoint health check failed", {
      baseUrl,
      error: message,
    });
  }

  healthCacheMap.set(baseUrl, result);
  return result;
}

/**
 * Check VProxy health across all configured endpoints.
 * Returns available=true if ANY endpoint is up (round-robin will route to it).
 */
export async function checkVProxyHealth(
  force = false,
): Promise<{ available: boolean; error: string | null }> {
  const urls = getVProxyUrls();
  const results = await Promise.all(
    urls.map((u) => checkSingleEndpoint(normalizeUrl(u), force)),
  );
  const anyAvailable = results.some((r) => r.available);
  const errors = results
    .filter((r) => !r.available)
    .map((r) => r.error)
    .filter(Boolean)
    .join("; ");

  if (anyAvailable) {
    const up = results.filter((r) => r.available).length;
    log.info(`VProxy health: ${up}/${urls.length} endpoints available`);
    return { available: true, error: null };
  }
  return { available: false, error: errors || "all VProxy endpoints down" };
}

export function isVProxyEnabled(): boolean {
  return process.env.USE_VPROXY_ANTHROPIC !== "false";
}

/**
 * Synchronous view of the last cached VProxy health.
 * Returns "available" when any endpoint is up, "down" when all recent checks
 * failed, "unknown" when we haven't probed yet.
 */
export function cachedVProxyHealth(): "available" | "down" | "unknown" {
  const urls = getVProxyUrls();
  let anyKnown = false;
  let anyUp = false;
  for (const raw of urls) {
    const normalized = normalizeUrl(raw);
    const cached = healthCacheMap.get(normalized);
    if (cached) {
      anyKnown = true;
      if (cached.available) anyUp = true;
    }
  }
  if (!anyKnown) return "unknown";
  return anyUp ? "available" : "down";
}

/**
 * Create a Strands OpenAIModel pointing at the Ollama-via-Hermes fallback.
 * Used by agent-factory when VProxy is unhealthy at agent-creation time.
 */
export function createOllamaFallbackModel(
  options?: VProxyModelOptions,
): OpenAIModel {
  const baseUrl = getOllamaBaseUrl();
  const modelId = options?.model || getOllamaModel();
  log.info("Creating Ollama-Qwen fallback model", { modelId, baseUrl });
  return new OpenAIModel({
    api: "chat",
    // Ollama OpenAI-compat endpoint accepts any non-empty bearer
    apiKey: process.env.OLLAMA_API_KEY || "ollama",
    clientConfig: { baseURL: `${baseUrl}/v1` },
    modelId,
    temperature: options?.temperature ?? 0.4,
    maxTokens: options?.maxTokens ?? 8192,
  });
}

/**
 * Chain-aware Strands model selection.
 * Returns VProxy model when VProxy is available, otherwise the Ollama-Qwen fallback.
 * Caller receives the active provider so telemetry + logs can tag it.
 */
export async function createChainModel(
  options?: VProxyModelOptions,
): Promise<{ model: OpenAIModel; provider: "vproxy" | "ollama-qwen" }> {
  if (isVProxyEnabled()) {
    const health = await checkVProxyHealth();
    if (health.available) {
      return { model: createVProxyModel(options), provider: "vproxy" };
    }
    if (!isOllamaFallbackEnabled()) {
      throw new Error(
        `VProxy unavailable (${health.error ?? "unknown"}) and Ollama fallback disabled`,
      );
    }
    log.warn(
      `[ai-chain] vproxy unhealthy (${health.error ?? "unknown"}), falling back to ollama-qwen for Strands agent`,
    );
    return {
      model: createOllamaFallbackModel(options),
      provider: "ollama-qwen",
    };
  }
  if (!isOllamaFallbackEnabled()) {
    throw new Error(
      "VProxy disabled and Ollama fallback disabled — no model available",
    );
  }
  return { model: createOllamaFallbackModel(options), provider: "ollama-qwen" };
}
