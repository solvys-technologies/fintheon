// [claude-code 2026-03-11] First-time setup guide card with status indicators
import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
  Server,
  Globe,
  FileText,
  Diff,
} from "lucide-react";
import { useGateway } from "../../contexts/GatewayContext";
import { useBackend } from "../../lib/backend";

type ServiceStatus = "connected" | "connecting" | "disconnected";

interface ServiceCheck {
  id: string;
  label: string;
  description: string;
  icon: typeof Server;
  status: ServiceStatus;
}

const STORAGE_KEY = "fintheon:setup-dismissed";

export function SetupGuideCard({
  onDismiss,
  onStartInterview,
}: {
  onDismiss?: () => void;
  onStartInterview?: () => void;
}) {
  const backend = useBackend();
  const { status: gatewayStatus } = useGateway();

  const [backendStatus, setBackendStatus] =
    useState<ServiceStatus>("connecting");
  const [dataLayerStatus, setDataLayerStatus] =
    useState<ServiceStatus>("connecting");
  const [marketDataStatus, setMarketDataStatus] =
    useState<ServiceStatus>("connecting");
  const [checking, setChecking] = useState(false);

  const runChecks = useCallback(async () => {
    setChecking(true);

    // Backend health check
    try {
      const res = await fetch("http://localhost:8080/health", {
        signal: AbortSignal.timeout(5000),
      });
      setBackendStatus(res.ok ? "connected" : "disconnected");
    } catch {
      setBackendStatus("disconnected");
    }

    // Data layer check — try fetching trade ideas
    try {
      const res = await fetch("http://localhost:8080/api/data/trade-ideas", {
        signal: AbortSignal.timeout(5000),
      });
      setDataLayerStatus(res.ok ? "connected" : "disconnected");
    } catch {
      setDataLayerStatus("disconnected");
    }

    // Market data check — try fetching IV score
    try {
      const data = await backend.marketData.getIVScore();
      setMarketDataStatus(data?.score != null ? "connected" : "disconnected");
    } catch {
      setMarketDataStatus("disconnected");
    }

    setChecking(false);
  }, [backend]);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    onDismiss?.();
  };

  const gwStatus: ServiceStatus =
    gatewayStatus === "connected"
      ? "connected"
      : gatewayStatus === "connecting"
        ? "connecting"
        : "disconnected";

  const services: ServiceCheck[] = [
    {
      id: "backend",
      label: "Backend API",
      description: "Hono server on port 8080",
      icon: Server,
      status: backendStatus,
    },
    {
      id: "gateway",
      label: "Hermes Agent",
      description: "AI agent router",
      icon: Globe,
      status: gwStatus,
    },
    {
      id: "data-layer",
      label: "Data Layer",
      description: "Trade ideas & briefs",
      icon: FileText,
      status: dataLayerStatus,
    },
    {
      id: "market",
      label: "Market Data (VIX)",
      description: "Yahoo Finance for IV scoring",
      icon: Diff,
      status: marketDataStatus,
    },
  ];

  const allConnected = services.every((s) => s.status === "connected");
  const connectedCount = services.filter(
    (s) => s.status === "connected",
  ).length;

  return (
    <div className="border border-[var(--fintheon-accent)]/30 rounded-xl bg-[#0b0b08] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--fintheon-accent)]">
            Setup Guide
          </h3>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)] font-medium">
            {connectedCount}/{services.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {onStartInterview &&
            !localStorage.getItem("fintheon:interview-completed") &&
            localStorage.getItem("fintheon:tour-completed") && (
              <button
                onClick={onStartInterview}
                className="px-2.5 py-1 rounded-md text-[10px] font-medium bg-[var(--fintheon-accent)]/15 border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/25 transition-colors"
              >
                Complete Setup
              </button>
            )}
          <button
            onClick={runChecks}
            disabled={checking}
            className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors disabled:opacity-40"
            title="Re-check all services"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Dismiss setup guide"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Status rows */}
      <div className="space-y-2">
        {services.map((svc) => {
          const Icon = svc.icon;
          return (
            <div
              key={svc.id}
              className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-white/[0.02]"
            >
              <Icon className="w-4 h-4 text-zinc-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-gray-300">
                  {svc.label}
                </div>
                <div className="text-[9px] text-zinc-500">
                  {svc.description}
                </div>
              </div>
              <StatusDot status={svc.status} />
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-3 pt-3 border-t border-white/5">
        {allConnected ? (
          <p className="text-[11px] text-green-400/80">
            All services connected. You're ready to trade.
          </p>
        ) : (
          <p className="text-[11px] text-zinc-500">
            See <span className="text-[var(--fintheon-accent)]">Settings</span>{" "}
            to configure missing services. Refer to SETUP.md for details.
          </p>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: ServiceStatus }) {
  if (status === "connected") {
    return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
  }
  if (status === "connecting") {
    return (
      <Loader2 className="w-4 h-4 text-yellow-500 animate-spin shrink-0" />
    );
  }
  return <AlertCircle className="w-4 h-4 text-red-500/70 shrink-0" />;
}

/** Check if setup guide should show (not yet dismissed) */
export function shouldShowSetupGuide(): boolean {
  return !localStorage.getItem(STORAGE_KEY);
}
