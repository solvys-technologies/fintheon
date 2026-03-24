// [claude-code 2026-03-24] Generic cloud state hook — read/write per-user state via backend
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const DEBOUNCE_MS = 1500;

/**
 * Generic hook for reading/writing per-user state via the backend.
 * Falls back to localStorage when not authenticated.
 *
 * @param key       - The top-level key within app_state (e.g. 'threads', 'layouts')
 * @param fallbackKey - localStorage key used when offline or unauthenticated
 * @param defaultValue - Default value if nothing is stored
 * @returns [value, setValue, isLoading]
 */
export function useCloudState<T>(
  key: string,
  fallbackKey: string,
  defaultValue: T,
): [T, (val: T | ((prev: T) => T)) => void, boolean] {
  const { isAuthenticated, getAccessToken } = useAuth();
  const [value, setValueInternal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(fallbackKey);
      return raw ? (JSON.parse(raw) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  const [isLoading, setIsLoading] = useState(isAuthenticated);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef(value);

  // Keep ref in sync
  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  // Load from cloud on mount (if authenticated)
  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) { setIsLoading(false); return; }

        const res = await fetch(`${API_BASE}/api/profile/app-state`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok || cancelled) { setIsLoading(false); return; }

        const data = await res.json() as { app_state?: Record<string, unknown> };
        const cloudValue = data.app_state?.[key];
        if (cloudValue !== undefined && !cancelled) {
          setValueInternal(cloudValue as T);
          localStorage.setItem(fallbackKey, JSON.stringify(cloudValue));
        }
      } catch {
        // Fall back to localStorage value (already set)
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, key, fallbackKey, getAccessToken]);

  // Debounced cloud persist
  const persistToCloud = useCallback(async (newValue: T) => {
    if (!isAuthenticated) return;
    try {
      const token = await getAccessToken();
      if (!token) return;

      // Merge into existing app_state
      await fetch(`${API_BASE}/api/profile/app-state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ state: { [key]: newValue } }),
      });
    } catch {
      // Silent fail — localStorage is still the source of truth
    }
  }, [isAuthenticated, getAccessToken, key]);

  const setValue = useCallback((valOrFn: T | ((prev: T) => T)) => {
    setValueInternal(prev => {
      const next = typeof valOrFn === 'function'
        ? (valOrFn as (prev: T) => T)(prev)
        : valOrFn;

      // Always persist to localStorage immediately
      try {
        localStorage.setItem(fallbackKey, JSON.stringify(next));
      } catch { /* ignore */ }

      // Debounced cloud persist
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        persistToCloud(next);
      }, DEBOUNCE_MS);

      return next;
    });
  }, [fallbackKey, persistToCloud]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return [value, setValue, isLoading];
}
