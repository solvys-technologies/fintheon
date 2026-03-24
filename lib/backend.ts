// [claude-code 2026-03-22] Supabase auth token — replaces Clerk useAuth().getToken()
import { getAccessToken } from './supabase';
import ApiClient from './apiClient';
import { createBackendClient, type BackendClient } from './services';

// Development mode: bypass authentication ONLY when explicitly enabled
const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const BYPASS_AUTH = DEV_MODE && import.meta.env.VITE_BYPASS_AUTH === 'true';

// Create base API client
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

// Export default client for non-hook usage
export default baseBackendClient;

// Re-export types and services
export { ApiClient } from './apiClient';
export * from './services';
