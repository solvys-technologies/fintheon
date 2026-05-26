// [claude-code 2026-03-16] Hermes settings tab — moved from standalone HermesCommandCenter page into Settings
// [claude-code 2026-03-20] Added startup config section — backend autostart + launch-on-login toggles
// [claude-code 2026-03-22] Show per-service diagnostics from SystemStatusContext + Hermes verification status
import { useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { RefreshCw, Power, Loader2 } from "lucide-react";
import { useGateway } from "../../contexts/GatewayContext";
import { useSettings } from "../../contexts/SettingsContext";
import { useFintheonAgents } from "../../contexts/FintheonAgentContext";
import { useSystemStatus } from "../../hooks/useSystemStatus";
import { HermesAgentCards } from "../hermes/HermesAgentCards";
import { HermesActivityLog, useActivityLog } from "../hermes/HermesActivityLog";
import { isElectron } from "../../lib/platform";
import { SettingsActionStatus } from "./SettingsActionStatus";

/* ------------------------------------------------------------------ */
/*  Section header                                                      */
/* ------------------------------------------------------------------ */

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-right">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--fintheon-accent)]/15 to-transparent" />
      <h3 className="text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--fintheon-accent)]">
        {title}
      </h3>
    </div>
  );
}

function SettingsStatusRow({
  label,
  detail,
  status,
  tone = "muted",
  children,
}: {
  label: string;
  detail?: string | null;
  status?: string | null;
  tone?: "muted" | "success" | "error" | "warning";
  children?: ReactNode;
}) {
  return (
    <div className="fintheon-fade-divider flex items-start justify-between gap-4 py-3 text-right">
      <div className="min-w-0 text-right">
        <p className="text-[11px] font-medium text-zinc-300">{label}</p>
        {detail && (
          <p className="mt-0.5 text-[10px] leading-snug text-zinc-600">
            {detail}
          </p>
        )}
      </div>
      <div className="flex min-w-[136px] shrink-0 flex-col items-end gap-1 text-right">
        {children}
        {status && <SettingsActionStatus label={status} tone={tone} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

export function HermesSettings() {
  const {
    status,
    hermesStatus,
    isVerifyingHermes,
    lastHealthCheck,
    reconnect,
    gatewayUrl,
  } = useGateway();
  const { gatewayPort } = useSettings();
  const { services, overall: systemOverall, refreshNow } = useSystemStatus();
  const { agents } = useFintheonAgents();
  const { entries } = useActivityLog();

  // Startup config (Electron only)
  const [backendAutostart, setBackendAutostart] = useState(true);
  const [launchOnLogin, setLaunchOnLogin] = useState(false);
  const [backendAlive, setBackendAlive] = useState<boolean | null>(null);
  const [backendToggling, setBackendToggling] = useState(false);

  useEffect(() => {
    if (!isElectron()) return;
    window.electron?.getStartupConfig().then((cfg) => {
      setBackendAutostart(cfg.backendAutostart);
      setLaunchOnLogin(cfg.launchOnLogin);
    });
    window.electron?.isBackendAlive().then((res) => setBackendAlive(res.alive));
  }, []);

  const handleToggleAutostart = useCallback(async (enabled: boolean) => {
    setBackendAutostart(enabled);
    await window.electron?.setStartupConfig({ backendAutostart: enabled });
  }, []);

  const handleToggleLaunchOnLogin = useCallback(async (enabled: boolean) => {
    setLaunchOnLogin(enabled);
    await window.electron?.setStartupConfig({ launchOnLogin: enabled });
  }, []);

  const handleStartBackend = useCallback(async () => {
    setBackendToggling(true);
    await window.electron?.startBackend();
    // Give it a moment to spin up
    setTimeout(async () => {
      const res = await window.electron?.isBackendAlive();
      setBackendAlive(res?.alive ?? false);
      setBackendToggling(false);
    }, 2000);
  }, []);

  const handleStopBackend = useCallback(async () => {
    setBackendToggling(true);
    await window.electron?.stopBackend();
    setTimeout(async () => {
      const res = await window.electron?.isBackendAlive();
      setBackendAlive(res?.alive ?? false);
      setBackendToggling(false);
    }, 1000);
  }, []);

  const statusLabel =
    status === "connected"
      ? "Connected"
      : status === "connecting"
        ? "Connecting..."
        : "Disconnected";

  return (
    <div className="space-y-6">
      {/* 0. Startup & Backend Process (Electron only) */}
      {isElectron() && (
        <section>
          <SectionHeader title="Startup & Backend" />
          <div className="space-y-0">
            <SettingsStatusRow
              label="Backend Process"
              status={backendAlive ? "Running" : "Stopped"}
              tone={backendAlive ? "success" : "error"}
            >
              <button
                onClick={backendAlive ? handleStopBackend : handleStartBackend}
                disabled={backendToggling}
                className={`flex items-center gap-1.5 text-[10px] font-medium transition-colors disabled:opacity-40 ${
                  backendAlive
                    ? "text-red-400 hover:text-red-300"
                    : "text-emerald-400 hover:text-emerald-300"
                }`}
              >
                <Power
                  className={`w-3 h-3 ${backendToggling ? "animate-spin" : ""}`}
                />
                {backendAlive ? "Stop" : "Start"}
              </button>
            </SettingsStatusRow>

            <SettingsStatusRow
              label="Auto-start backend on app launch"
              detail="Spawns the Hono backend when Fintheon opens"
              status={backendAutostart ? "Enabled" : "Off"}
              tone={backendAutostart ? "success" : "muted"}
            >
              <button
                onClick={() => handleToggleAutostart(!backendAutostart)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  backendAutostart
                    ? "bg-[var(--fintheon-accent)]"
                    : "bg-zinc-700"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    backendAutostart
                      ? "translate-x-[18px]"
                      : "translate-x-[3px]"
                  }`}
                />
              </button>
            </SettingsStatusRow>

            <SettingsStatusRow
              label="Launch Fintheon on login"
              detail="Opens the app automatically when you sign into your Mac"
              status={launchOnLogin ? "Enabled" : "Off"}
              tone={launchOnLogin ? "success" : "muted"}
            >
              <button
                onClick={() => handleToggleLaunchOnLogin(!launchOnLogin)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  launchOnLogin ? "bg-[var(--fintheon-accent)]" : "bg-zinc-700"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    launchOnLogin ? "translate-x-[18px]" : "translate-x-[3px]"
                  }`}
                />
              </button>
            </SettingsStatusRow>
          </div>
        </section>
      )}

      {/* 1. Gateway Status Card */}
      <section>
        <SectionHeader title="Gateway Status" />
        <div className="space-y-0">
          <SettingsStatusRow
            label="Gateway Status"
            detail={`${gatewayUrl} · Port ${gatewayPort}${
              lastHealthCheck
                ? ` · Last check ${new Date(lastHealthCheck).toLocaleTimeString()}`
                : ""
            }`}
            status={statusLabel}
            tone={
              status === "connected"
                ? "success"
                : status === "connecting"
                  ? "warning"
                  : "error"
            }
          />
          <SettingsStatusRow label="Hermes AI">
            <div className="flex flex-col items-end gap-1 text-right">
              {isVerifyingHermes ? (
                <>
                  <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
                  <span className="text-[11px] text-yellow-400">
                    Verifying...
                  </span>
                </>
              ) : (
                <>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      hermesStatus === "ok"
                        ? "bg-emerald-500"
                        : hermesStatus === "degraded"
                          ? "bg-yellow-500"
                          : hermesStatus === "error"
                            ? "bg-red-500"
                            : "bg-zinc-600"
                    }`}
                  />
                  <span
                    className={`text-[11px] font-medium ${
                      hermesStatus === "ok"
                        ? "text-emerald-400"
                        : hermesStatus === "degraded"
                          ? "text-yellow-400"
                          : hermesStatus === "error"
                            ? "text-red-400"
                            : "text-zinc-500"
                    }`}
                  >
                    {hermesStatus === "ok"
                      ? "Active"
                      : hermesStatus === "degraded"
                        ? "Degraded"
                        : hermesStatus === "error"
                          ? "Unavailable"
                          : "Unknown"}
                  </span>
                </>
              )}
            </div>
          </SettingsStatusRow>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={reconnect}
              className="fintheon-action-link flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em]"
            >
              <RefreshCw className="w-3 h-3" /> Reconnect
            </button>
            <button
              onClick={refreshNow}
              className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Refresh Diagnostics
            </button>
          </div>
        </div>
      </section>

      {/* 1b. Service Diagnostics */}
      {services.length > 0 && (
        <section>
          <SectionHeader title="Service Diagnostics" />
          <div className="space-y-0">
            {services.map((svc) => (
              <SettingsStatusRow
                key={svc.key}
                label={svc.name}
                detail={svc.detail}
                status={svc.status}
                tone={
                  svc.status === "ok"
                    ? "success"
                    : svc.status === "degraded"
                      ? "warning"
                      : svc.status === "error"
                        ? "error"
                        : "muted"
                }
              />
            ))}
            <div className="pt-2 text-right">
              <SettingsActionStatus
                label={systemOverall}
                detail="Overall service state"
                tone={
                  systemOverall === "ok"
                    ? "success"
                    : systemOverall === "degraded"
                      ? "warning"
                      : systemOverall === "error"
                        ? "error"
                        : "muted"
                }
              />
            </div>
          </div>
        </section>
      )}

      {/* 3. Agent Status Cards */}
      <section>
        <SectionHeader title="Agent Status" />
        <HermesAgentCards agents={agents} />
      </section>

      {/* 4. Activity Log (last 10 requests) */}
      <section>
        <SectionHeader title="Recent Activity" />
        <div className="h-[280px] rounded-lg border border-[var(--fintheon-accent)]/20 overflow-hidden bg-[var(--fintheon-bg)] p-3">
          <HermesActivityLog entries={entries} />
        </div>
      </section>
    </div>
  );
}
