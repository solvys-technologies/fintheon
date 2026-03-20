// [claude-code 2026-03-10] Gateway toast: show once per session only (sessionStorage guard)
// [claude-code 2026-03-11] Gateway port now configurable via Settings → persisted in localStorage
import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useToast } from './ToastContext';
import { useSettings } from './SettingsContext';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type GatewayStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface GatewayContextValue {
  status: GatewayStatus;
  lastHealthCheck: string | null;
  reconnect: () => void;
  gatewayUrl: string;
}

const GatewayContext = createContext<GatewayContextValue>({
  status: 'disconnected',
  lastHealthCheck: null,
  reconnect: () => {},
  gatewayUrl: 'http://localhost:8080',
});

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_GATEWAY_PORT = 8080;
const HEALTH_INTERVAL_MS = 30_000; // 30 seconds
const MAX_BACKOFF_MS = 60_000;

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function GatewayProvider({ children }: { children: ReactNode }) {
  const { gatewayPort } = useSettings();
  const [status, setStatus] = useState<GatewayStatus>('connecting');
  const [lastHealthCheck, setLastHealthCheck] = useState<string | null>(null);
  const backoffRef = useRef(2000);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { addToast, dismissToast } = useToast();
  const connectingToastRef = useRef<string | null>(null);

  const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || `http://localhost:${gatewayPort || DEFAULT_GATEWAY_PORT}`;

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${gatewayUrl}/health`, { signal: AbortSignal.timeout(5000) });
      const contentType = res.headers.get('content-type') || '';
      const looksLikeJson = contentType.includes('application/json');
      if (res.ok && looksLikeJson) {
        const wasDisconnected = status === 'disconnected' || status === 'error' || status === 'connecting';
        setStatus('connected');
        setLastHealthCheck(new Date().toISOString());
        backoffRef.current = 2000; // reset backoff

        if (wasDisconnected) {
          // Dismiss any lingering connecting toast
          if (connectingToastRef.current) {
            dismissToast(connectingToastRef.current);
            connectingToastRef.current = null;
          }
          // [claude-code 2026-03-10] Gateway toast: show once per session only
          if (!sessionStorage.getItem('gateway_connected_shown')) {
            sessionStorage.setItem('gateway_connected_shown', '1');
            addToast('Hermes connected', 'success');
          }
        }
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (_err) {
      const wasConnected = status === 'connected';
      setStatus('disconnected');

      // Only toast when we were previously connected (avoid noise on first load / no gateway)
      if (wasConnected) {
        addToast('Hermes disconnected — retrying...', 'error');
      }

      // Exponential backoff retry
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
      retryTimerRef.current = setTimeout(checkHealth, backoffRef.current);
    }
  }, [status, addToast, dismissToast, gatewayUrl]);

  const reconnect = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setStatus('connecting');
    connectingToastRef.current = addToast('Reconnecting to Hermes...', 'updating');
    backoffRef.current = 2000;
    checkHealth();
  }, [checkHealth, addToast]);

  // Initial connection + periodic health checks (re-trigger when port changes)
  useEffect(() => {
    setStatus('connecting');
    backoffRef.current = 2000;
    checkHealth();
    const interval = setInterval(checkHealth, HEALTH_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatewayUrl]);

  return (
    <GatewayContext.Provider value={{ status, lastHealthCheck, reconnect, gatewayUrl }}>
      {children}
    </GatewayContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export const useGateway = () => useContext(GatewayContext);
