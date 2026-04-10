// [claude-code 2026-04-03] Supabase JWT always attached — no auth bypass in any environment
import { getAccessToken } from "./supabase";
import ApiClient from "./apiClient";
import { createBackendClient, type BackendClient } from "./services";

// Authenticated API client — always sends Supabase JWT
const apiClient = new ApiClient(undefined, async () => getAccessToken());

const backendClient = createBackendClient(apiClient);

export function useBackend(): BackendClient {
  return backendClient;
}

export default backendClient;

// Re-export types and services
export { default as ApiClient } from "./apiClient";
export * from "./services";
