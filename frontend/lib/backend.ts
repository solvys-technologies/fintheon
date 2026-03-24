// [claude-code 2026-03-22] Supabase auth token — mirrors root lib/backend.ts
import { getAccessToken } from './supabase';
import ApiClient from "./apiClient";
import { createBackendClient, type BackendClient } from "./services";

// Bypass auth in Electron (file:// or localhost) or when explicitly enabled in dev
const IS_ELECTRON = typeof window !== 'undefined' && (window.location.protocol === 'file:' || (window.location.hostname === 'localhost' && window.location.port !== ''));
const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const BYPASS_AUTH = IS_ELECTRON || import.meta.env.VITE_BYPASS_AUTH === 'true' || DEV_MODE;

// Create base API client (unauthenticated — used only in bypass mode)
const baseApiClient = new ApiClient();
const baseBackendClient = createBackendClient(baseApiClient);

// Hook for when Supabase auth is available (normal mode)
function useBackendWithSupabase(): BackendClient {
  const authenticatedClient = baseApiClient.withAuth(async () => {
    return getAccessToken();
  });
  return createBackendClient(authenticatedClient);
}

// Hook for dev mode without auth
function useBackendWithoutAuth(): BackendClient {
  return baseBackendClient;
}

// Export the appropriate hook based on environment
export const useBackend = BYPASS_AUTH ? useBackendWithoutAuth : useBackendWithSupabase;

// Export default client for non-hook usage (unauthenticated — prefer useBackend())
export default baseBackendClient;

// Re-export types and services
export { default as ApiClient } from "./apiClient";
export * from "./services";
