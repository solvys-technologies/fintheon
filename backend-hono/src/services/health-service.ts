import { pingDb } from "../db/optimized.js";
import { defaultAiConfig } from "../config/ai-config.js";
import { supabaseAuthHealth } from "./supabase-auth.js";

type ComponentStatus = "ok" | "degraded" | "error";

export interface HealthStatus {
  status: ComponentStatus;
  timestamp: string;
  components: Record<
    "database" | "aiGateway" | "auth",
    {
      status: ComponentStatus;
      details?: Record<string, unknown>;
    }
  >;
}

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs: number,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};

const checkDatabase = async () => {
  try {
    await pingDb();
    return { status: "ok" as ComponentStatus };
  } catch (error) {
    // Database is optional in cloud (Supabase handles persistence) — degraded, not error
    return {
      status: "degraded" as ComponentStatus,
      details: {
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
};

// Cache aiGateway health for 30s. /health is polled every ~2s by the frontend;
// hitting OpenRouter on every poll makes /health stall (2–5s) while Harper/Grok
// are slamming OpenRouter, which flips the GatewayContext to "disconnected" and
// shows the spurious "Hermes disconnecting" toast.
let aiGatewayCache: {
  value: { status: ComponentStatus; details?: Record<string, unknown> };
  expiresAt: number;
} | null = null;
const AI_GATEWAY_CACHE_TTL_MS = 30_000;
const AI_GATEWAY_PROBE_TIMEOUT_MS = 2500;

const checkAiGateway = async () => {
  if (aiGatewayCache && aiGatewayCache.expiresAt > Date.now()) {
    return aiGatewayCache.value;
  }

  const baseUrl =
    defaultAiConfig.models["openrouter-opus"]?.baseUrl ??
    process.env.OPENROUTER_BASE_URL ??
    "https://openrouter.ai/api/v1";
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    const result = {
      status: "error" as ComponentStatus,
      details: { error: "Missing OPENROUTER_API_KEY" },
    };
    aiGatewayCache = {
      value: result,
      expiresAt: Date.now() + AI_GATEWAY_CACHE_TTL_MS,
    };
    return result;
  }

  try {
    const response = await fetchWithTimeout(
      `${baseUrl.replace(/\/v1$/, "")}/v1/models`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
      AI_GATEWAY_PROBE_TIMEOUT_MS,
    );

    const statusCode = response.status;
    const isHealthy = statusCode >= 200 && statusCode < 400;

    const result = {
      status: isHealthy
        ? ("ok" as ComponentStatus)
        : ("degraded" as ComponentStatus),
      details: { statusCode },
    };
    aiGatewayCache = {
      value: result,
      expiresAt: Date.now() + AI_GATEWAY_CACHE_TTL_MS,
    };
    return result;
  } catch (error) {
    const result = {
      status: "error" as ComponentStatus,
      details: {
        message: error instanceof Error ? error.message : String(error),
      },
    };
    // Cache errors briefly too so a single network blip doesn't flap the UI
    aiGatewayCache = { value: result, expiresAt: Date.now() + 5_000 };
    return result;
  }
};

const checkAuth = () => {
  const details = supabaseAuthHealth();
  return {
    status: details.hasCredentials
      ? ("ok" as ComponentStatus)
      : ("degraded" as ComponentStatus),
    details,
  };
};

export const createHealthService = () => {
  const checkAll = async (): Promise<HealthStatus> => {
    const [database, aiGateway, auth] = await Promise.all([
      checkDatabase(),
      checkAiGateway(),
      checkAuth(),
    ]);

    const components = { database, aiGateway, auth };
    const hasError = Object.values(components).some(
      (component) => component.status === "error",
    );
    const hasDegraded = Object.values(components).some(
      (component) => component.status === "degraded",
    );

    const status: ComponentStatus = hasError
      ? "error"
      : hasDegraded
        ? "degraded"
        : "ok";

    return {
      status,
      timestamp: new Date().toISOString(),
      components,
    };
  };

  return { checkAll };
};
