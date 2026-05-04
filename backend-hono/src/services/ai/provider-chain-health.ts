// [claude-code 2026-05-03] S58-T1: health snapshot for DeepSeek provider chain.
import { getVProxyHealth } from "../vproxy/anthropic-client.js";
import { getOllamaHealth, getOllamaModel } from "./ollama-hermes-client.js";

export interface ChainHealth {
  primary: {
    provider: "deepseek-direct";
    available: boolean;
    latencyMs: number | null;
    model: string;
    error: string | null;
  };
  fallback: {
    provider: "openrouter";
    model: string;
    available: boolean;
    latencyMs: number | null;
    error: string | null;
  };
  lastResort: {
    provider: "vproxy";
    model: string;
    available: boolean;
    latencyMs: number | null;
    error: string | null;
  };
}

export async function getChainHealth(): Promise<ChainHealth> {
  const [vproxy, deepseek] = await Promise.all([
    getVProxyHealth().catch((err: unknown) => ({
      available: false,
      baseUrl: "",
      model: "",
      checkedAt: Date.now(),
      error: err instanceof Error ? err.message : String(err),
      enabled: true,
    })),
    getOllamaHealth().catch((err: unknown) => ({
      available: false,
      baseUrl: "",
      model: getOllamaModel(),
      checkedAt: Date.now(),
      error: err instanceof Error ? err.message : String(err),
      enabled: true,
    })),
  ]);
  const openrouterAvailable = Boolean(process.env.OPENROUTER_API_KEY);
  return {
    primary: {
      provider: "deepseek-direct",
      available: deepseek.available,
      latencyMs: null,
      model: deepseek.model,
      error: deepseek.error,
    },
    fallback: {
      provider: "openrouter",
      model: "deepseek/deepseek-reasoner",
      available: openrouterAvailable,
      latencyMs: null,
      error: openrouterAvailable ? null : "OPENROUTER_API_KEY not set",
    },
    lastResort: {
      provider: "vproxy",
      model: vproxy.model,
      available: vproxy.available,
      latencyMs: null,
      error: vproxy.error,
    },
  };
}
