// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — Hermes settings tab
// [claude-code 2026-03-20] S3:T3 — merged Connection+Hermes tabs into settings
import { useState, useEffect, useCallback } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { useGateway } from "../../contexts/GatewayContext";
import { useToast } from "../../contexts/ToastContext";
import { HermesSettings } from "./HermesSettings";
import { SettingsActionStatus } from "./SettingsActionStatus";

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
      <section>
        <h3 className="mb-4 text-right text-sm font-semibold text-[var(--fintheon-accent)]">
          Gateway Connection
        </h3>
        <div className="fintheon-fade-divider pb-2">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="text-right text-sm font-medium text-white">
              Gateway
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <button
                onClick={reconnect}
                className="fintheon-action-link text-[10px] font-semibold uppercase tracking-[0.14em]"
              >
                Reconnect
              </button>
              <SettingsActionStatus
                label={statusLabel}
                detail={gatewayUrl}
                tone={
                  status === "connected"
                    ? "success"
                    : status === "connecting"
                      ? "warning"
                      : "error"
                }
              />
            </div>
          </div>
          <div className="space-y-1 text-right text-xs text-gray-500">
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
        <div className="fintheon-fade-divider mt-4 pb-2 text-right">
          <h4 className="mb-3 text-sm font-medium text-white">
            Persistent Thread
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 text-right">
              <span className="text-[11px] font-medium text-white">
                Enable persistent thread
              </span>
              <button
                type="button"
                onClick={() => handleTogglePersistent(!persistentEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  persistentEnabled ? "bg-[var(--fintheon-accent)]" : "bg-zinc-700"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-black transition-transform ${
                    persistentEnabled ? "translate-x-[18px]" : "translate-x-[3px]"
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="mb-1 block text-right text-xs text-gray-400">
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
            <p className="text-right text-[11px] text-gray-500">
              Keep a single conversation thread across refreshes. Prevents
              new-conversation flicker.
            </p>
          </div>
        </div>
      </section>

      <HermesSettings />

      <section>
        <div className="mb-3 flex items-center justify-end gap-3 text-right">
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
            <div className="space-y-0">
              {(diagnostics.services ?? []).map((svc) => (
                <div
                  key={svc.name}
                  className="fintheon-fade-divider flex items-start justify-between gap-4 py-3 text-right"
                >
                  <span className="text-[11px] font-semibold text-white">
                    {svc.name}
                  </span>
                  <div className="flex min-w-0 flex-col items-end gap-1 text-right">
                    <div
                      className={`h-2 w-2 rounded-full ${statusDot(svc.status)}`}
                    />
                    <SettingsActionStatus
                      label={svc.status}
                      detail={svc.fix || svc.detail}
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
                  </div>
                </div>
              ))}
            </div>

            {/* Missing env vars */}
            {(diagnostics.missingEnvVars ?? []).length > 0 && (
              <div className="mt-3 bg-[var(--fintheon-bg)] border border-red-500/20 rounded-lg p-3 text-right">
                <div className="mb-1 text-[11px] font-semibold text-red-400">
                  Missing Environment Variables
                </div>
                <div className="space-y-0.5 font-mono text-[10px] text-gray-500">
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

            <div className="mt-2 text-right text-[10px] text-zinc-600">
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

    </div>
  );
}
