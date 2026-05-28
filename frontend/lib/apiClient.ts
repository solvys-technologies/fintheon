// [claude-code 2026-05-03] S58-T2: add user AI-key helper for client-side DeepSeek transports.
// [claude-code 2026-03-16] Added global error bus emission for toast notifications
/**
 * Hono API Client
 *
 * This client is designed to work with a Hono backend API.
 * Replace the base URL with your Hono backend endpoint.
 */

import { emitApiError } from "./errorBus";
import { getRuntimeApiBase } from "./runtime-api-base";

const API_BASE_URL = getRuntimeApiBase();

// Global auth failure state - stops all polling when auth fails
let authFailed = false;
let authFailedTimestamp: number | null = null;
const AUTH_RETRY_DELAY_MS = 30000; // Wait 30s before retrying after auth failure
const MAX_401_COUNT = 3; // Maximum consecutive 401s before giving up
let consecutive401Count = 0;
let last401Timestamp: number | null = null;

const MAX_RETRIES = 3;
const MAX_CONCURRENT = 6; // Browser limit per origin for HTTP/1.1
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const BASE_RETRY_DELAY_MS = 400;

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const buildRetryDelay = (attempt: number) => {
  const jitter = Math.random() * 150;
  return BASE_RETRY_DELAY_MS * 2 ** attempt + jitter;
};

// --- Concurrency limiter: prevents ERR_INSUFFICIENT_RESOURCES ---
let inFlight = 0;
const queue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    queue.push(() => {
      inFlight++;
      resolve();
    });
  });
}

function releaseSlot() {
  inFlight--;
  const next = queue.shift();
  if (next) next();
}

// Detect resource exhaustion errors (retrying makes these worse)
function isResourceExhausted(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("failed to fetch") && inFlight >= MAX_CONCURRENT - 1;
}

// Export function to reset auth state (call on successful login)
export function resetAuthState() {
  authFailed = false;
  authFailedTimestamp = null;
  consecutive401Count = 0;
  last401Timestamp = null;
}

// Check if auth has failed and we should skip requests
function shouldSkipRequest(): boolean {
  if (!authFailed) return false;

  // Reset if enough time has passed
  if (
    authFailedTimestamp &&
    Date.now() - authFailedTimestamp > AUTH_RETRY_DELAY_MS
  ) {
    authFailed = false;
    authFailedTimestamp = null;
    consecutive401Count = 0;
    return false;
  }

  return true;
}

// Track 401 errors to prevent flooding
function handle401Error(): void {
  const now = Date.now();

  // Reset counter if it's been more than 1 minute since last 401
  if (last401Timestamp && now - last401Timestamp > 60000) {
    consecutive401Count = 0;
  }

  consecutive401Count++;
  last401Timestamp = now;

  // Set global auth failure flag to stop future requests
  authFailed = true;
  authFailedTimestamp = now;

  if (consecutive401Count >= MAX_401_COUNT) {
    console.warn(
      `[API] Multiple auth failures (${consecutive401Count}). Auto-logout disabled for debugging.`,
    );
  } else if (consecutive401Count < MAX_401_COUNT) {
    console.warn(
      `[API] Auth failed (${consecutive401Count}/${MAX_401_COUNT}). Auto-logout disabled for debugging.`,
    );
  }
}

export interface ApiError {
  code: string;
  message: string;
  status?: number;
}

class ApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;

  constructor(
    baseUrl: string = API_BASE_URL,
    getAuthToken?: () => Promise<string | null>,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.getAuthToken = getAuthToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Wait for a connection slot before executing
    await acquireSlot();

    try {
      return await this._executeWithRetry(url, endpoint, options, 0);
    } finally {
      releaseSlot();
    }
  }

  private async _executeWithRetry<T>(
    url: string,
    endpoint: string,
    options: RequestInit,
    attempt: number,
  ): Promise<T> {
    const execute = async (attempt: number): Promise<T> => {
      // Skip request if auth has failed recently (prevents error cascade)
      // But exempt public endpoints that don't require auth
      const isPublicEndpoint =
        endpoint.startsWith("/api/riskflow/") ||
        endpoint.startsWith("/api/predictions/") ||
        endpoint.startsWith("/api/data/") ||
        endpoint.startsWith("/api/agent-desk/") ||
        endpoint.startsWith("/api/diagnostics/") ||
        endpoint.startsWith("/api/market-data/") ||
        endpoint.startsWith("/api/market/");
      if (!isPublicEndpoint && shouldSkipRequest()) {
        const err: ApiError = {
          code: "auth_skipped",
          message:
            "Skipping request due to recent auth failure. Will retry in 30s.",
          status: 401,
        };
        emitApiError({ ...err, endpoint });
        throw err;
      }

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...options.headers,
      };

      // Add auth token if available
      if (this.getAuthToken) {
        const token = await this.getAuthToken();
        if (token) {
          (headers as Record<string, string>)["Authorization"] =
            `Bearer ${token}`;
        }
      }

      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorData: any;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }

          const error: ApiError = {
            code: errorData.code || `http_${response.status}`,
            message:
              errorData.message ||
              `HTTP ${response.status}: ${response.statusText}`,
            status: response.status,
          };

          if (response.status === 401) {
            error.code = errorData.code || "unauthenticated";
            handle401Error();
            emitApiError({ ...error, endpoint });
            throw error;
          }

          if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_RETRIES) {
            console.warn(
              `[API] Retryable response ${response.status} for ${endpoint} (attempt ${attempt + 1}/${MAX_RETRIES})`,
            );
            await sleep(buildRetryDelay(attempt));
            return execute(attempt + 1);
          }

          if (response.status === 404) {
            error.code = "not_found";
          } else if (response.status >= 500) {
            error.code = "server_error";
            console.error(
              `[API] Server error ${response.status} for ${endpoint}:`,
              errorData,
            );
          }

          // Reset 401 counter on successful requests
          if (response.status !== 401) {
            consecutive401Count = 0;
            last401Timestamp = null;
          }

          emitApiError({ ...error, endpoint });
          throw error;
        }

        // Handle empty responses
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.warn(
            `[API] Unexpected content-type: ${contentType} for ${endpoint}, returning empty object`,
          );
          console.warn(
            `[API] Response status: ${response.status}, headers:`,
            Object.fromEntries(response.headers.entries()),
          );
          return {} as T;
        }

        const jsonData = await response.json();
        return jsonData;
      } catch (error) {
        const isApiError =
          error && typeof error === "object" && "code" in error;

        // Don't retry on resource exhaustion — retrying makes it worse
        if (!isApiError && isResourceExhausted(error)) {
          console.warn(
            `[API] Resource exhaustion on ${endpoint} — skipping retry`,
          );
          const netErr: ApiError = {
            code: "resource_exhausted",
            message: "Too many concurrent requests. Try again shortly.",
          };
          emitApiError({ ...netErr, endpoint });
          throw netErr;
        }

        if (!isApiError && attempt < MAX_RETRIES) {
          console.warn(
            `[API] Network error on ${endpoint} (attempt ${attempt + 1}/${MAX_RETRIES})`,
            error,
          );
          await sleep(buildRetryDelay(attempt));
          return execute(attempt + 1);
        }

        if (isApiError) {
          throw error;
        }

        const netErr: ApiError = {
          code: "network_error",
          message:
            error instanceof Error ? error.message : "Network request failed",
        };
        emitApiError({ ...netErr, endpoint });
        throw netErr;
      }
    };

    return execute(0);
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  async getUserApiKey(provider: string): Promise<string | null> {
    const data = await this.get<Record<string, unknown>>(
      `/api/settings/ai-keys?provider=${encodeURIComponent(provider)}`,
    ).catch(() => null);
    if (!data) return null;
    const candidates = [data.apiKey, data.key, data.decryptedKey, data.value];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
    return null;
  }

  // Create a new client instance with updated auth token getter
  withAuth(getAuthToken: () => Promise<string | null>): ApiClient {
    return new ApiClient(this.baseUrl, getAuthToken);
  }
}

export default ApiClient;
