// [claude-code 2026-03-16] Global error event bus — bridges apiClient errors to React toast system
// [claude-code 2026-03-22] Wire emitApiError → error log ring buffer for persistent error history

import { pushError } from "./errorLog";

export interface ApiErrorEvent {
  code: string;
  message: string;
  status?: number;
  endpoint?: string;
  stack?: string;
}

type ErrorListener = (error: ApiErrorEvent) => void;

const listeners = new Set<ErrorListener>();

/** Subscribe to API errors. Returns unsubscribe function. */
export function onApiError(listener: ErrorListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Emit an API error to all listeners + persist to error log */
export function emitApiError(error: ApiErrorEvent): void {
  listeners.forEach((fn) => fn(error));

  pushError({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    code: error.code,
    message: error.message,
    status: error.status,
    endpoint: error.endpoint,
    fix: getFixDescription(error.code, error.status),
    stack: error.stack,
  });
}

/* ------------------------------------------------------------------ */
/*  Fix descriptions — short user-facing hints per error type          */
/* ------------------------------------------------------------------ */

const FIX_MAP: Record<string, string> = {
  network_error: "Check if the backend is running on port 8080.",
  auth_skipped: "Auth failed recently. Restart the app or wait 30s.",
  unauthenticated: "Session expired. Refresh or re-login.",
  http_401: "Session expired. Refresh or re-login.",
  http_403: "Permission denied. Check your access level.",
  not_found: "Endpoint missing. Backend may need an update.",
  http_404: "Endpoint missing. Backend may need an update.",
  server_error: "Backend error. Check logs or restart backend.",
  http_500: "Backend error. Check logs or restart backend.",
  http_502: "Backend unavailable. It may still be starting up.",
  http_503: "Backend unavailable. It may still be starting up.",
  http_504: "Backend timed out. Try again in a moment.",
  http_429: "Rate limited. Wait a moment and retry.",
  http_408: "Request timed out. Check your connection.",
};

/** Get a short fix description for a given error code / status */
export function getFixDescription(code: string, status?: number): string {
  if (FIX_MAP[code]) return FIX_MAP[code];
  if (status && FIX_MAP[`http_${status}`]) return FIX_MAP[`http_${status}`];
  return "Try again or restart the app.";
}
