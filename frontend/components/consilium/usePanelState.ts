// [claude-code 2026-04-10] Extracted from ConsiliumHub.tsx
import { useState, useCallback } from "react";

export function usePanelState(
  key: string,
  defaultValue: boolean,
): [boolean, () => void] {
  const [state, setState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const toggle = useCallback(() => {
    setState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }, [key]);

  return [state, toggle];
}
