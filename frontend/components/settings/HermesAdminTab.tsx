// [claude-code 2026-04-19] S27-T11: mount GepaWidget on diagnostics surface.
// [claude-code 2026-04-19] S27-T9 W2e: mount RoutingWidget on diagnostics surface.
// [claude-code 2026-04-19] S27-T4: mount HeadlineVolumeWidget on diagnostics surface.
// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — Hermes:Admin merged tab
// [claude-code 2026-03-20] S3:T3 — merged Connection+Hermes tabs into Hermes:Admin
import React, { useState, useEffect, useCallback } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { useGateway } from "../../contexts/GatewayContext";
import { useToast } from "../../contexts/ToastContext";
import Toggle from "../Toggle";
import { HermesSettings } from "./HermesSettings";
import { HeadlineVolumeWidget } from "../diagnostics/HeadlineVolumeWidget";
import { RoutingWidget } from "../diagnostics/RoutingWidget";
import { GepaWidget } from "../diagnostics/GepaWidget";

interface DiagnosticService {
  name: string;
  status: "ok" | "error" | "degraded" | "unavailable";
  detail?: string;
  fix?: string;
}

interface DiagnosticsData {
  timestamp: string;
  overall: string;
  services: DiagnosticService[];
  missingEnvVars: string[];
}

export function HermesAdminTab() {
  const { status, lastHealthCheck, reconnect, gatewayUrl } = useGateway();
  const { addToast } = useToast();
  const statusColor =
    status === "connected"
      ? "#34D399"
      : status === "connecting"
        ? "var(--fintheon-accent)"
        : "#EF4444";
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  const [persistentEnabled, setPersistentEnabled] = useState(
    () =>
      localStorage.getItem("fintheon:gateway-persistent-thread-enabled") ===
      "true",
  );
  const [persistentThreadId, setPersistentThreadId] = useState(
    () => localStorage.getItem("fintheon:gateway-persistent-thread-id") ?? "",
  );

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8080";

  const fetchDiagnostics = useCallback(async () => {
    setDiagLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/diagnostics`);
      const data: DiagnosticsData = await res.json();
      setDiagnostics(data);

      // Check for errors and trigger handoff CTA
      const errors = (data.services ?? []).filter((s) => s.status === "error");
      if (errors.length > 0) {
        const errorNames = errors.map((e) => e.name).join(", ");
        const simpleFixable = errors.every(
          (e) => e.fix && !e.fix.includes("Claude Code"),
        );

        if (simpleFixable) {
          addToast(
            `${errors.length} service${errors.length > 1 ? "s" : ""} need attention`,
            "error",
            errors.map((e) => `${e.name}: ${e.fix}`).join(" | "),
          );
        } else {
          addToast(`Service errors detected: ${errorNames}`, "error");
        }
      }
    } catch {
      addToast(
        "Failed to reach diagnostics endpoint",
        "error",
        "Is the backend running? Run: fintheon start",
      );
    } finally {
      setDiagLoading(false);
    }
  }, [apiBase, addToast]);

  // Fetch diagnostics on mount
  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  const handleTogglePersistent = (enabled: boolean) => {
    setPersistentEnabled(enabled);
    localStorage.setItem(
      "fintheon:gateway-persistent-thread-enabled",
      String(enabled),
    );
  };

  const handleThreadIdChange = (id: string) => {
    setPersistentThreadId(id);
    localStorage.setItem("fintheon:gateway-persistent-thread-id", id);
  };

  const handleCopyHandoff = useCallback(() => {
    if (!diagnostics) return;

    const errors = diagnostics.services.filter(
      (s) => s.status === "error" || s.status === "degraded",
    );
    const prompt = [
      `## Fintheon Diagnostics Handoff`,
      `**Timestamp:** ${diagnostics.timestamp}`,
      `**Overall:** ${diagnostics.overall}`,
      ``,
      `### Failing Services`,
      ...errors.map(
        (e) =>
          `- **${e.name}**: ${e.status} — ${e.detail}${e.fix ? `\n  Fix: ${e.fix}` : ""}`,
      ),
      ``,
      `### Missing Env Vars`,
      diagnostics.missingEnvVars.length > 0
        ? diagnostics.missingEnvVars.map((v) => `- \`${v}\``).join("\n")
        : "(none)",
      ``,
      `### Suggested Approach`,
      `1. Fix missing env vars in \`backend-hono/.env\``,
      `2. Restart backend: \`fintheon start\``,
      `3. Re-run diagnostics to verify`,
    ].join("\n");

    navigator.clipboard.writeText(prompt);
    addToast("Handoff prompt copied", "success");
  }, [diagnostics, addToast]);

  const statusDot = (s: DiagnosticService["status"]) => {
    const colors: Record<string, string> = {
      ok: "bg-emerald-500",
      error: "bg-red-500",
      degraded: "bg-yellow-500",
      unavailable: "bg-zinc-600",
    };
    return colors[s] || "bg-zinc-600";
  };

  return (
    <div className="space-y-6">
      {/* 1. Gateway Status */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-4">
          Gateway Connection
        </h3>
        <div className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: statusColor }}
              />
              <span className="text-sm font-medium text-white">
                {statusLabel}
              </span>
            </div>
            <button
              onClick={reconnect}
              className="text-xs text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30 rounded px-3 py-1 hover:bg-[var(--fintheon-accent)]/10 transition-colors"
            >
              Reconnect
            </button>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p>
              URL: <span className="text-gray-400">{gatewayUrl}</span>
            </p>
            {lastHealthCheck && (
              <p>
                Last check:{" "}
                <span className="text-gray-400">
                  {new Date(lastHealthCheck).toLocaleTimeString()}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Persistent Thread */}
        <div className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-lg p-4 mt-3">
          <h4 className="text-sm font-medium text-white mb-3">
            Persistent Thread
          </h4>
          <div className="space-y-3">
            <Toggle
              label="Enable persistent thread"
              enabled={persistentEnabled}
              onChange={handleTogglePersistent}
            />
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Thread / Conversation ID
              </label>
              <input
                type="text"
                value={persistentThreadId}
                onChange={(e) => handleThreadIdChange(e.target.value)}
                disabled={!persistentEnabled}
                placeholder="e.g. conv_abc123..."
                className={`w-full bg-[var(--fintheon-bg)] border rounded px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none transition-colors ${
                  persistentEnabled
                    ? "border-[var(--fintheon-accent)]/30 focus:border-[var(--fintheon-accent)]/60"
                    : "border-gray-700/30 opacity-50 cursor-not-allowed"
                }`}
              />
            </div>
            <p className="text-[11px] text-gray-500">
              Keep a single conversation thread across refreshes. Prevents
              new-conversation flicker.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Hermes agent settings (existing component) */}
      <HermesSettings />

      {/* 3. Backend Dependency Status Cards */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--fintheon-accent)]">
            Backend Dependencies
          </h3>
          <button
            onClick={fetchDiagnostics}
            disabled={diagLoading}
            className="flex items-center gap-1.5 text-[10px] text-[var(--fintheon-accent)] hover:text-[var(--fintheon-accent)]/80 transition-colors disabled:opacity-40"
          >
            <RefreshCw
              className={`w-3 h-3 ${diagLoading ? "animate-spin" : ""}`}
            />{" "}
            Refresh
          </button>
        </div>

        {!diagnostics && diagLoading && (
          <div className="text-xs text-gray-500 py-4 text-center">
            Checking services...
          </div>
        )}

        {diagnostics && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {(diagnostics.services ?? []).map((svc) => (
                <div
                  key={svc.name}
                  className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/15 rounded-lg p-3"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className={`w-2 h-2 rounded-full ${statusDot(svc.status)}`}
                    />
                    <span className="text-[11px] font-semibold text-white truncate">
                      {svc.name}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 leading-relaxed">
                    {svc.detail || svc.status}
                  </div>
                  {svc.status === "error" && svc.fix && (
                    <div className="text-[10px] text-red-400/80 mt-1 leading-relaxed">
                      {svc.fix}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Missing env vars */}
            {(diagnostics.missingEnvVars ?? []).length > 0 && (
              <div className="mt-3 bg-[var(--fintheon-bg)] border border-red-500/20 rounded-lg p-3">
                <div className="text-[11px] font-semibold text-red-400 mb-1">
                  Missing Environment Variables
                </div>
                <div className="text-[10px] text-gray-500 font-mono space-y-0.5">
                  {(diagnostics.missingEnvVars ?? []).map((v) => (
                    <div key={v}>{v}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Handoff Prompt CTA — shown when there are errors */}
            {(diagnostics.services ?? []).some((s) => s.status === "error") && (
              <button
                onClick={handleCopyHandoff}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--fintheon-accent)]/30 bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)] text-[11px] font-semibold hover:bg-[var(--fintheon-accent)]/20 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Handoff Prompt
              </button>
            )}

            <div className="text-[10px] text-zinc-600 mt-2">
              Last checked:{" "}
              {new Date(diagnostics.timestamp).toLocaleTimeString()}
            </div>
          </>
        )}

        {!diagnostics && !diagLoading && (
          <div className="text-xs text-red-400/70 py-4 text-center">
            Could not reach backend. Is it running?
          </div>
        )}
      </section>

      {/* 4. Headline Volume (S27-T4) */}
      <section>
        <HeadlineVolumeWidget />
      </section>

      {/* 5. Smart Model Routing (S27-T9 W2e) */}
      <section>
        <RoutingWidget />
      </section>

      {/* 6. GEPA self-improvement loop (S27-T11) */}
      <section>
        <GepaWidget />
      </section>
    </div>
  );
}
