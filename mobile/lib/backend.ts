// [claude-code 2026-04-15] T2: Mobile backend client — re-uses frontend ApiClient + services with mobile auth
import ApiClient from "@frontend/lib/apiClient";
import {
  createBackendClient,
  type BackendClient,
} from "@frontend/lib/services";

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
  const apiClient = new ApiClient(undefined, getAccessToken);
  cachedClient = createBackendClient(apiClient);
  cachedTokenGetter = getAccessToken;
  return cachedClient;
}

export type { BackendClient };
