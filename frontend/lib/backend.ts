// [claude-code 2026-03-16] Auth-aware backend client via BackendProvider context
import { createContext, useContext, useMemo, createElement, type ReactNode } from 'react';
import ApiClient from "./apiClient";
import { createBackendClient, type BackendClient } from "./services";

// Unauthenticated fallback (used when outside BackendProvider or in bypass mode)
const fallbackApiClient = new ApiClient();
const fallbackBackendClient = createBackendClient(fallbackApiClient);

const BackendContext = createContext<BackendClient>(fallbackBackendClient);

/**
 * BackendProvider — wraps children with an auth-aware BackendClient.
 * Pass getToken from Clerk's useAuth() to attach Bearer tokens to API calls.
 */
export function BackendProvider({
  children,
  getToken,
}: {
  children: ReactNode;
  getToken?: () => Promise<string | null>;
}) {
  const client = useMemo(() => {
    if (!getToken) return fallbackBackendClient;
    const apiClient = new ApiClient(undefined, getToken);
    return createBackendClient(apiClient);
  }, [getToken]);

  return createElement(BackendContext.Provider, { value: client }, children);
}

/**
 * Hook to get the backend client.
 * Returns auth-aware client when inside BackendProvider, fallback otherwise.
 */
export function useBackend(): BackendClient {
  return useContext(BackendContext);
}

// Export default client for non-hook usage (e.g. top-level scripts)
export default fallbackBackendClient;

// Re-export types and services
export { default as ApiClient } from "./apiClient";
export * from "./services";
