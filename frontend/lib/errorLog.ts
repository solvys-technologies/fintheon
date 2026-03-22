// [claude-code 2026-03-22] Error log ring buffer — persists API errors in memory for the ErrorLogPanel

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  code: string;
  message: string;
  status?: number;
  endpoint?: string;
  fix?: string;
  stack?: string;
  details?: Record<string, unknown>;
}

const MAX_ENTRIES = 50;
const buffer: ErrorLogEntry[] = [];
const listeners = new Set<() => void>();

/** Push an error into the ring buffer (newest first). */
export function pushError(entry: ErrorLogEntry): void {
  buffer.unshift(entry);
  if (buffer.length > MAX_ENTRIES) buffer.pop();
  listeners.forEach((fn) => fn());
}

/** Get the current error log (newest first). */
export function getErrorLog(): ErrorLogEntry[] {
  return buffer;
}

/** Clear all errors from the log. */
export function clearErrorLog(): void {
  buffer.length = 0;
  listeners.forEach((fn) => fn());
}

/** Subscribe to error log changes. Returns unsubscribe function. */
export function onErrorLogChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
