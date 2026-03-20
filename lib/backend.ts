import { useAuth } from "@clerk/clerk-react";
import ApiClient from "./apiClient";
import { createBackendClient, type BackendClient } from "./services";

// Development mode: bypass Clerk authentication ONLY when explicitly enabled
const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const BYPASS_AUTH = DEV_MODE && import.meta.env.VITE_BYPASS_AUTH === 'true';

// Create base API client
const baseApiClient = new ApiClient();
const baseBackendClient = createBackendClient(baseApiClient);

// Hook for when Clerk is available (normal mode)
function useBackendWithClerk(): BackendClient {
  const { getToken, isSignedIn } = useAuth();
  
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
export const useBackend = BYPASS_AUTH ? useBackendWithoutAuth : useBackendWithClerk;

// Export default client for non-hook usage
export default baseBackendClient;

// Re-export types and services
export { ApiClient } from "./apiClient";
export * from "./services";
