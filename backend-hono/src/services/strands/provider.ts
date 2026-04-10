// [claude-code 2026-04-10] Round-robin across multiple VProxy endpoints via VPROXY_URLS env var
// [claude-code 2026-04-04] Strands SDK VProxy model provider — OpenAI-compatible endpoint at localhost:8317
import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("StrandsVProxy");

const DEFAULT_BASE_URL = "http://localhost:8317";
const DEFAULT_MODEL = "claude-opus-4-6";
const DEFAULT_API_KEY = "CLI_PROXY_API_KEY";
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
