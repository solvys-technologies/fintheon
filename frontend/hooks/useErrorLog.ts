// [claude-code 2026-03-22] React hook for subscribing to the error log ring buffer

import { useSyncExternalStore, useCallback } from "react";
import {
  getErrorLog,
  clearErrorLog,
  onErrorLogChange,
  type ErrorLogEntry,
} from "../lib/errorLog";

export function useErrorLog(): {
  errors: ErrorLogEntry[];
  errorCount: number;
  clearErrors: () => void;
} {
  const errors = useSyncExternalStore(
    onErrorLogChange,
    getErrorLog,
    getErrorLog,
  );

  const clearErrors = useCallback(() => clearErrorLog(), []);

  return { errors, errorCount: errors.length, clearErrors };
}
