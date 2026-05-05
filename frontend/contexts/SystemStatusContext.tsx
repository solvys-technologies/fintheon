// [claude-code 2026-03-22] Unified system status context — polls /api/diagnostics for per-service health

import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useGateway } from "./GatewayContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type StatusLevel = "ok" | "degraded" | "error" | "unknown";

export interface ServiceHealth {
  name: string;
  key: string;
  status: StatusLevel;
  detail?: string;
  fix?: string;
  lastChecked: string;
}

export interface SystemStatusValue {
  overall: StatusLevel;
  services: ServiceHealth[];
  lastFullCheck: string | null;
  isChecking: boolean;
  refreshNow: () => void;
}

export const SystemStatusContext = createContext<SystemStatusValue>({
  overall: "unknown",
  services: [],
  lastFullCheck: null,
  isChecking: false,
  refreshNow: () => {},
});

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const POLL_INTERVAL_MS = 30_000;

/** Map backend service names → short display keys for the footer */
const KEY_MAP: Record<string, string> = {
  Hermes: "ai",
  "Hermes AI (DeepSeek primary)": "ai",
  "Hermes AI (OpenRouter)": "ai",
  Supabase: "database",
  "X Feed": "x-feed",
  "Supabase Auth": "auth",
  "TradingView Econ Calendar": "econ",
  "TradingView Quotes": "quotes",
};

const SHORT_NAMES: Record<string, string> = {
  Hermes: "Hermes",
  "Hermes AI (DeepSeek primary)": "Hermes",
  "Hermes AI (OpenRouter)": "AI",
  Supabase: "Database",
  "X Feed": "X",
  "Supabase Auth": "Auth",
  "TradingView Econ Calendar": "econ",
  "TradingView Quotes": "quotes",
};

function normalizeStatus(s: string): StatusLevel {
  if (s === "ok") return "ok";
  if (s === "degraded") return "degraded";
  if (s === "error") return "error";
  if (s === "unavailable") return "error";
  return "unknown";
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function SystemStatusProvider({ children }: { children: ReactNode }) {
  const { status: gatewayStatus, gatewayUrl } = useGateway();
  const [overall, setOverall] = useState<StatusLevel>("unknown");
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [lastFullCheck, setLastFullCheck] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const prevGatewayStatus = useRef(gatewayStatus);

  const fetchDiagnostics = useCallback(async () => {
    if (gatewayStatus !== "connected") {
      setOverall("unknown");
      setServices((prev) =>
        prev.map((s) => ({ ...s, status: "unknown" as StatusLevel })),
      );
      return;
    }

    setIsChecking(true);
    try {
      const res = await fetch(`${gatewayUrl}/api/diagnostics`, {
        signal: AbortSignal.timeout(8000),
      });
      const data = (await res.json()) as {
        timestamp: string;
        overall: string;
        services: Array<{
          name: string;
          status: string;
          detail?: string;
          fix?: string;
        }>;
      };

      const now = new Date().toISOString();
      const mapped: ServiceHealth[] = data.services.map((svc) => ({
        name: SHORT_NAMES[svc.name] ?? svc.name,
        key: KEY_MAP[svc.name] ?? svc.name.toLowerCase().replace(/\s+/g, "-"),
        status: normalizeStatus(svc.status),
        detail: svc.detail,
        fix: svc.fix,
        lastChecked: now,
      }));

      setServices(mapped);
      setOverall(normalizeStatus(data.overall));
      setLastFullCheck(now);
    } catch {
      // If diagnostics fetch fails but gateway is connected, mark as degraded
      setOverall("degraded");
    } finally {
      setIsChecking(false);
    }
  }, [gatewayStatus, gatewayUrl]);

  // Poll on interval
  useEffect(() => {
    if (gatewayStatus !== "connected") return;

    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [gatewayStatus, fetchDiagnostics]);

  // Immediate refresh when gateway transitions to connected
  useEffect(() => {
    if (
      prevGatewayStatus.current !== "connected" &&
      gatewayStatus === "connected"
    ) {
      fetchDiagnostics();
    }
    prevGatewayStatus.current = gatewayStatus;
  }, [gatewayStatus, fetchDiagnostics]);

  return (
    <SystemStatusContext.Provider
      value={{
        overall,
        services,
        lastFullCheck,
        isChecking,
        refreshNow: fetchDiagnostics,
      }}
    >
      {children}
    </SystemStatusContext.Provider>
  );
}
