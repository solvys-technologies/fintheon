// [claude-code 2026-03-16] Backend dependency setup wizard — health checks with auto-recheck
import { useState, useEffect, useCallback } from "react";
import {
  X,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Terminal,
} from "lucide-react";

interface CheckStatus {
  label: string;
  description: string;
  status: "ok" | "warn" | "fail" | "checking";
  helpUrl?: string;
  command?: string;
}

interface SetupWizardProps {
  visible: boolean;
  onClose: () => void;
}

const STATUS_ICON = {
  ok: <CheckCircle className="w-4 h-4 text-green-500" />,
  warn: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  fail: <XCircle className="w-4 h-4 text-red-500" />,
  checking: <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />,
};

export function SetupWizard({ visible, onClose }: SetupWizardProps) {
  const [checks, setChecks] = useState<CheckStatus[]>([
    {
      label: "Backend API",
      description: "Hono server on port 8080",
      status: "checking",
      command: "fintheon start",
    },
    {
      label: "Hermes / OpenRouter",
      description: "AI inference key configured",
      status: "checking",
      helpUrl: "https://openrouter.ai",
    },
    {
      label: "Data Layer",
      description: "Trade ideas & briefs endpoint",
      status: "checking",
    },
    {
      label: "Market Data",
      description: "IV score endpoint responding",
      status: "checking",
    },
  ]);
  const [copied, setCopied] = useState<number | null>(null);

  const runChecks = useCallback(async () => {
    const results: CheckStatus[] = [...checks].map((c) => ({
      ...c,
      status: "checking" as const,
    }));
    setChecks([...results]);

    // 1. Backend API health
    try {
      const res = await fetch("http://localhost:8080/health", {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        results[0].status = "ok";
        // 2. Check OpenRouter key from health response
        results[1].status =
          data.openRouterKey || data.hermesReady ? "ok" : "warn";
      } else {
        results[0].status = "fail";
        results[1].status = "fail";
      }
    } catch {
      results[0].status = "fail";
      results[1].status = "fail";
    }

    // 3. Supabase data layer (was Notion polling)
    try {
      const res = await fetch("http://localhost:8080/api/data/trade-ideas", {
        signal: AbortSignal.timeout(3000),
      });
      results[2].status = res.ok ? "ok" : "warn";
    } catch {
      results[2].status = results[0].status === "fail" ? "fail" : "warn";
    }

    // 4. Market data / IV score
    try {
      const res = await fetch(
        "http://localhost:8080/api/market-data/iv-score",
        { signal: AbortSignal.timeout(3000) },
      );
      results[3].status = res.ok ? "ok" : "warn";
    } catch {
      results[3].status = results[0].status === "fail" ? "fail" : "warn";
    }

    setChecks([...results]);
  }, []);

  // Auto-check every 5 seconds
  useEffect(() => {
    if (!visible) return;
    runChecks();
    const interval = setInterval(runChecks, 5000);
    return () => clearInterval(interval);
  }, [visible, runChecks]);

  const allPassing = checks.every((c) => c.status === "ok");
  const hasElectron =
    typeof window !== "undefined" && !!(window as any).electron;

  const handleRunCommand = (command: string) => {
    if (hasElectron) {
      (window as any).electron.runShellCommand(command);
    }
  };

  const handleCopyCommand = (command: string, idx: number) => {
    navigator.clipboard.writeText(command);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleOpenExternal = (url: string) => {
    if (hasElectron && (window as any).electron.shell?.openExternal) {
      (window as any).electron.shell.openExternal(url);
    } else {
      window.open(url, "_blank");
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[460px] bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/30 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--fintheon-accent)]/15">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[var(--fintheon-accent)]" />
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--fintheon-accent)]">
              System Setup
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Checks */}
        <div className="px-5 py-4 space-y-3">
          {checks.map((check, idx) => (
            <div
              key={check.label}
              className="flex items-start gap-3 p-3 rounded-lg bg-black/20 border border-white/5"
            >
              <div className="mt-0.5">{STATUS_ICON[check.status]}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">
                  {check.label}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {check.description}
                </div>

                {check.status === "fail" && check.command && (
                  <div className="mt-2 flex items-center gap-2">
                    {hasElectron ? (
                      <button
                        onClick={() => handleRunCommand(check.command!)}
                        className="text-[11px] px-2.5 py-1 rounded bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30 hover:bg-[var(--fintheon-accent)]/25 transition-colors"
                      >
                        Run Setup
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCopyCommand(check.command!, idx)}
                        className="text-[11px] px-2.5 py-1 rounded bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-colors font-mono"
                      >
                        {copied === idx ? "Copied" : check.command}
                      </button>
                    )}
                  </div>
                )}

                {check.status !== "ok" && check.helpUrl && (
                  <button
                    onClick={() => handleOpenExternal(check.helpUrl!)}
                    className="mt-2 flex items-center gap-1 text-[11px] text-[var(--fintheon-accent)] hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Setup Guide
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--fintheon-accent)]/10">
          <button
            onClick={() => handleOpenExternal("https://claude.ai")}
            className="text-xs text-gray-400 hover:text-[var(--fintheon-accent)] transition-colors"
          >
            Need help? Open Claude
          </button>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 text-xs font-medium rounded transition-all ${
              allPassing
                ? "bg-[var(--fintheon-accent)] text-black hover:brightness-110"
                : "bg-white/10 text-gray-400 hover:bg-white/15"
            }`}
          >
            {allPassing ? "All Good — Continue" : "Skip for Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
