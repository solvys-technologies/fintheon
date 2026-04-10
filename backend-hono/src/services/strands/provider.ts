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

let healthCache: {
  available: boolean;
  checkedAt: number;
  error: string | null;
} | null = null;

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
  const raw = process.env.VPROXY_BASE_URL || DEFAULT_BASE_URL;
  const stripped = raw.replace(/\/+$/, "");
  return stripped.endsWith("/v1") ? stripped : `${stripped}/v1`;
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

/** Check VProxy health (cached) */
export async function checkVProxyHealth(
  force = false,
): Promise<{ available: boolean; error: string | null }> {
  if (
    !force &&
    healthCache &&
    Date.now() - healthCache.checkedAt < HEALTH_CACHE_TTL_MS
  ) {
    return healthCache;
  }

  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();

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

    healthCache = { available: true, checkedAt: Date.now(), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    healthCache = { available: false, checkedAt: Date.now(), error: message };
    log.warn("VProxy health check failed", { error: message });
  }

  return healthCache!;
}

export function isVProxyEnabled(): boolean {
  return process.env.USE_VPROXY_ANTHROPIC !== "false";
}
