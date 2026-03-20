import { useSafeAuth } from "./clerk-hooks";
import ApiClient from "./apiClient";
import { createBackendClient, type BackendClient } from "./services";

// Bypass Clerk in Electron (localhost) or dev mode
const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const IS_ELECTRON = typeof window !== 'undefined' && (window.location.protocol === 'file:' || window.location.hostname === 'localhost');
const BYPASS_AUTH = IS_ELECTRON || (DEV_MODE && import.meta.env.VITE_BYPASS_AUTH === 'true');
const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
const SHOULD_BYPASS = BYPASS_AUTH || !CLERK_KEY;

// Create base API client
const baseApiClient = new ApiClient();
const baseBackendClient = createBackendClient(baseApiClient);

// Hook for when Clerk is available (normal mode)
function useBackendWithClerk(): BackendClient {
  const { getToken, isSignedIn } = useSafeAuth();
  
  if (!isSignedIn) {
    return baseBackendClient;
  }
  
  const authenticatedClient = baseApiClient.withAuth(async () => {
    const token = await getToken();
    return token;
  });
  
  return createBackendClient(authenticatedClient);
}

// Hook for dev mode without Clerk
function useBackendWithoutAuth(): BackendClient {
  return baseBackendClient;
}

// Export the appropriate hook based on environment
export const useBackend = SHOULD_BYPASS ? useBackendWithoutAuth : useBackendWithClerk;

// Export default client for non-hook usage
export default baseBackendClient;

// Re-export types and services
export { ApiClient } from "./apiClient";
export * from "./services";
