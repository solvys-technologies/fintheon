// [claude-code 2026-03-10] Gateway toast: show once per session only (sessionStorage guard)
// [claude-code 2026-03-11] Gateway port now configurable via Settings → persisted in localStorage
// [claude-code 2026-03-22] Parse /health response body, verify Hermes AI on startup, auto-restart if down
// [claude-code 2026-04-17] Hydrate gateway/hermes status from localStorage to avoid self-team-card
//                          flashing red on app reopen before first health poll resolves
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useToast } from "./ToastContext";
import { useSettings } from "./SettingsContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type GatewayStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "error";
export type HermesStatus = "ok" | "degraded" | "error" | "unknown";

interface HealthResponse {
  status: string;
  timestamp: string;
  components: {
    database: { status: string; details?: string };
    aiGateway: { status: string; details?: string };
    auth: { status: string; details?: string };
  };
}

interface GatewayContextValue {
  status: GatewayStatus;
  hermesStatus: HermesStatus;
  isVerifyingHermes: boolean;
  lastHealthCheck: string | null;
  reconnect: () => void;
  gatewayUrl: string;
}

const GatewayContext = createContext<GatewayContextValue>({
  status: "disconnected",
  hermesStatus: "unknown",
  isVerifyingHermes: false,
  lastHealthCheck: null,
  reconnect: () => {},
  gatewayUrl: "http://localhost:8080",
});

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_GATEWAY_PORT = 8080;
const HEALTH_INTERVAL_MS = 30_000; // 30 seconds
const MAX_BACKOFF_MS = 60_000;
const HERMES_RESTART_DELAY_MS = 3000;
const MAX_HERMES_RETRIES = 2;
const CACHE_KEY = "fintheon:gatewayHealth";
const CACHE_MAX_AGE_MS = 10 * 60 * 1000;

interface CachedHealth {
  status: GatewayStatus;
  hermesStatus: HermesStatus;
  lastHealthCheck: string;
}

function loadCachedHealth(): CachedHealth | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedHealth;
    const lastMs = new Date(cached.lastHealthCheck).getTime();
    if (!Number.isFinite(lastMs)) return null;
    if (Date.now() - lastMs > CACHE_MAX_AGE_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

function persistHealth(
  status: GatewayStatus,
  hermesStatus: HermesStatus,
  lastHealthCheck: string,
) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ status, hermesStatus, lastHealthCheck }),
    );
  } catch {
    // Cache is best-effort
  }
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function GatewayProvider({ children }: { children: ReactNode }) {
  const { gatewayPort } = useSettings();
  const cachedHealth = loadCachedHealth();
  const [status, setStatus] = useState<GatewayStatus>(
    cachedHealth?.status ?? "connecting",
  );
  const [hermesStatus, setHermesStatus] = useState<HermesStatus>(
    cachedHealth?.hermesStatus ?? "unknown",
  );
  const [isVerifyingHermes, setIsVerifyingHermes] = useState(false);
  const [lastHealthCheck, setLastHealthCheck] = useState<string | null>(
    cachedHealth?.lastHealthCheck ?? null,
  );
  const backoffRef = useRef(2000);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { addToast, dismissToast } = useToast();
  const connectingToastRef = useRef<string | null>(null);
  const hermesRestartAttempts = useRef(0);

  const gatewayUrl =
    import.meta.env.VITE_GATEWAY_URL ||
    `http://localhost:${gatewayPort || DEFAULT_GATEWAY_PORT}`;

  /** Attempt to restart Hermes via backend, then re-check health */
  const attemptHermesRestart = useCallback(async () => {
    if (hermesRestartAttempts.current >= MAX_HERMES_RETRIES) {
      setIsVerifyingHermes(false);
      setHermesStatus("error");
      addToast(
        "Hermes AI unavailable — check OpenRouter API key",
        "error",
        undefined,
        "connection-status",
      );
      hermesRestartAttempts.current = 0;
      return;
    }

    hermesRestartAttempts.current++;
    setIsVerifyingHermes(true);

    try {
      await fetch(`${gatewayUrl}/api/diagnostics/hermes/restart`, {
        method: "POST",
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      // Restart request failed — will retry on next cycle
    }

    // Wait before re-checking
    await new Promise((resolve) =>
      setTimeout(resolve, HERMES_RESTART_DELAY_MS),
    );

    // Re-check health to see if Hermes recovered
    try {
      const res = await fetch(`${gatewayUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const body = (await res.json()) as HealthResponse;
      const aiStatus = body?.components?.aiGateway?.status;

      if (aiStatus === "ok") {
        setHermesStatus("ok");
        setIsVerifyingHermes(false);
        hermesRestartAttempts.current = 0;
      } else {
        // Recurse for another attempt
        attemptHermesRestart();
      }
    } catch {
      setIsVerifyingHermes(false);
      setHermesStatus("error");
      hermesRestartAttempts.current = 0;
    }
  }, [gatewayUrl, addToast]);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${gatewayUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const contentType = res.headers.get("content-type") || "";
      const looksLikeJson = contentType.includes("application/json");

      if (looksLikeJson) {
        // Parse the response body to check per-component health
        const body = (await res.json()) as HealthResponse;
        const wasDisconnected =
          status === "disconnected" ||
          status === "error" ||
          status === "connecting";

        const nowIso = new Date().toISOString();
        setStatus("connected");
        setLastHealthCheck(nowIso);
        backoffRef.current = 2000;

        // Update Hermes status from health response
        const aiStatus = body?.components?.aiGateway?.status;
        let resolvedHermes: HermesStatus = "unknown";
        if (aiStatus === "ok") {
          resolvedHermes = "ok";
          setHermesStatus("ok");
          hermesRestartAttempts.current = 0;
        } else if (aiStatus === "degraded") {
          resolvedHermes = "degraded";
          setHermesStatus("degraded");
        } else if (
          wasDisconnected &&
          aiStatus === "error" &&
          !isVerifyingHermes
        ) {
          // First time connecting and Hermes is down — trigger restart
          resolvedHermes = "error";
          setHermesStatus("error");
          attemptHermesRestart();
        } else if (aiStatus === "error") {
          resolvedHermes = "error";
          setHermesStatus("error");
        }

        persistHealth("connected", resolvedHermes, nowIso);

        if (wasDisconnected) {
          if (connectingToastRef.current) {
            dismissToast(connectingToastRef.current);
            connectingToastRef.current = null;
          }
          // [claude-code 2026-03-10] Gateway toast: show once per session only
          if (!sessionStorage.getItem("gateway_connected_shown")) {
            sessionStorage.setItem("gateway_connected_shown", "1");
            addToast(
              "Hermes connected",
              "success",
              undefined,
              "connection-status",
            );
          }
        }
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (_err) {
      const wasConnected = status === "connected";
      setStatus("disconnected");
      setHermesStatus("unknown");

      if (wasConnected) {
        addToast(
          "Hermes disconnected — retrying...",
          "error",
          undefined,
          "connection-status",
        );
      }

      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
      retryTimerRef.current = setTimeout(checkHealth, backoffRef.current);
    }
  }, [
    status,
    addToast,
    dismissToast,
    gatewayUrl,
    isVerifyingHermes,
    attemptHermesRestart,
  ]);

  const reconnect = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setStatus("connecting");
    setHermesStatus("unknown");
    hermesRestartAttempts.current = 0;
    connectingToastRef.current = addToast(
      "Reconnecting to Hermes...",
      "updating",
      undefined,
      "connection-status",
    );
    backoffRef.current = 2000;
    checkHealth();
  }, [checkHealth, addToast]);

  // Initial connection + periodic health checks (re-trigger when port changes)
  // On first mount we keep any cached status so the team card doesn't flash
  // red; only a gatewayUrl change (port swap) resets to "connecting".
  const gatewayUrlChangeRef = useRef(false);
  useEffect(() => {
    if (gatewayUrlChangeRef.current) {
      setStatus("connecting");
      setHermesStatus("unknown");
    }
    gatewayUrlChangeRef.current = true;
    backoffRef.current = 2000;
    hermesRestartAttempts.current = 0;
    checkHealth();
    const interval = setInterval(checkHealth, HEALTH_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatewayUrl]);

  return (
    <GatewayContext.Provider
      value={{
        status,
        hermesStatus,
        isVerifyingHermes,
        lastHealthCheck,
        reconnect,
        gatewayUrl,
      }}
    >
      {children}
    </GatewayContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export const useGateway = () => useContext(GatewayContext);
