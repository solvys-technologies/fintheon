import ApiClient from "./apiClient";
import { createBackendClient, type BackendClient } from "./services";

/**
 * Backend Client - Local Single-User Mode
 * No authentication required
 */

// Create base API client
const baseApiClient = new ApiClient();
const baseBackendClient = createBackendClient(baseApiClient);

// Simple hook that returns the backend client
export function useBackend(): BackendClient {
  return baseBackendClient;
}

// Export default client for non-hook usage
export default baseBackendClient;

// Re-export types and services
export { default as ApiClient } from "./apiClient";
export * from "./services";
