// [claude-code 2026-04-16] Mobile backend client — uses empty baseUrl for relative paths through Vercel proxy
import ApiClient from "@frontend/lib/apiClient";
import {
  createBackendClient,
  type BackendClient,
} from "@frontend/lib/services";

const MOBILE_API_BASE = import.meta.env.VITE_API_URL ?? "";

let cachedClient: BackendClient | null = null;
let cachedTokenGetter: (() => Promise<string | null>) | null = null;

/**
 * Create or return the mobile BackendClient singleton.
 * Must be called with the auth context's getAccessToken on first use.
 */
export function getMobileBackend(
  getAccessToken: () => Promise<string | null>,
): BackendClient {
  if (cachedClient && cachedTokenGetter === getAccessToken) return cachedClient;
  const apiClient = new ApiClient(MOBILE_API_BASE, getAccessToken);
  cachedClient = createBackendClient(apiClient);
  cachedTokenGetter = getAccessToken;
  return cachedClient;
}

export type { BackendClient };
