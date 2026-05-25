import { pingDb } from "../db/optimized.js";
import { supabaseAuthHealth } from "./supabase-auth.js";
import {
  getRecentAiProviderIssue,
  recordAiProviderFailure,
} from "./ai/provider-credit-status.js";

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

// Cache aiGateway health for 30s. /health is polled frequently by Electron and
// the frontend; the probe must stay lightweight and gateway-local.
let aiGatewayCache: {
  value: { status: ComponentStatus; details?: Record<string, unknown> };
  expiresAt: number;
} | null = null;
const AI_GATEWAY_CACHE_TTL_MS = 30_000;
const AI_GATEWAY_PROBE_TIMEOUT_MS = 2500;

function getHermesGatewayBaseUrl(): string {
  const raw =
    process.env.HERMES_API_URL ||
    process.env.OPENCODE_GO_API_URL ||
    "http://localhost:8081/v1";
  const stripped = raw.replace(/\/+$/, "");
  return stripped.endsWith("/v1") ? stripped : `${stripped}/v1`;
}

const checkAiGateway = async () => {
  const recentIssue = getRecentAiProviderIssue();
  if (recentIssue?.code === "ai_credits_exhausted") {
    return {
      status: "degraded" as ComponentStatus,
      details: {
        code: recentIssue.code,
        provider: recentIssue.provider,
        message: recentIssue.message,
        occurrences: recentIssue.occurrences,
        fix: "Top up the Hermes gateway provider credits or replace the API key in Settings > API.",
      },
    };
  }

  if (aiGatewayCache && aiGatewayCache.expiresAt > Date.now()) {
    return aiGatewayCache.value;
  }

  const baseUrl = getHermesGatewayBaseUrl();
  const apiKey =
    process.env.HERMES_API_KEY ||
    process.env.OPENCODE_GO_API_KEY ||
    process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    const result = {
      status: "degraded" as ComponentStatus,
      details: {
        code: "ai_key_missing",
        error: "Missing Hermes gateway API key",
      },
    };
    aiGatewayCache = {
      value: result,
      expiresAt: Date.now() + AI_GATEWAY_CACHE_TTL_MS,
    };
    return result;
  }

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/models`,
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
    if (!isHealthy) {
      const text = await response.text().catch(() => "");
      const err = new Error(`Hermes gateway ${statusCode}: ${text}`);
      const issue = recordAiProviderFailure("hermes-gateway", err);
      if (issue?.code === "ai_credits_exhausted") {
        const result = {
          status: "degraded" as ComponentStatus,
          details: {
            code: issue.code,
            provider: issue.provider,
            statusCode,
            message: issue.message,
            fix: "Top up the Hermes gateway provider credits or replace the API key in Settings > API.",
          },
        };
        aiGatewayCache = {
          value: result,
          expiresAt: Date.now() + 5_000,
        };
        return result;
      }
    }

    const result = {
      status: isHealthy
        ? ("ok" as ComponentStatus)
        : ("degraded" as ComponentStatus),
      details: { provider: "hermes-gateway", statusCode },
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
