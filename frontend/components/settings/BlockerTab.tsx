// [claude-code 2026-05-12] TopStepX PWA Blocker — settings tab for enabling/disabling system-wide blocking
import { useState, useEffect, useCallback } from "react";
import { Shield, ShieldOff, RefreshCw, Lock, Globe } from "lucide-react";

interface BlockerState {
  blocked: boolean;
  isLoading: boolean;
  error: string | null;
}

function getBlockerApi() {
  const e = (
    window as unknown as {
      electron?: {
        blocker?: {
          enable: () => Promise<unknown>;
          disable: () => Promise<unknown>;
          getStatus: () => Promise<{ blocked: boolean }>;
        };
      };
    }
  ).electron;
  return e?.blocker ?? null;
}

export function BlockerTab() {
  const [state, setState] = useState<BlockerState>({
    blocked: false,
    isLoading: true,
    error: null,
  });
  const [toggling, setToggling] = useState(false);

  const refresh = useCallback(async () => {
    const api = getBlockerApi();
    if (!api) {
      setState({
        blocked: false,
        isLoading: false,
        error: "Not running in Electron",
      });
      return;
    }
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const result = await api.getStatus();
      setState({
        blocked: result.blocked,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState({
        blocked: false,
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggle = async () => {
    const api = getBlockerApi();
    if (!api) return;
    setToggling(true);
    try {
      if (state.blocked) {
        await api.disable();
      } else {
        await api.enable();
      }
      await refresh();
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setToggling(false);
    }
  };

  const api = getBlockerApi();
  const isElectron = api !== null;

  if (!isElectron) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[var(--fintheon-accent)]/60" />
          <span className="text-[14px] font-semibold text-white tracking-tight">
            Website Blocker
          </span>
        </div>
        <div className="rounded-lg border border-[var(--fintheon-accent)]/10 p-5 bg-[rgba(10,10,0,0.4)]">
          <p className="text-[13px] text-gray-500">
            Website blocker is only available in the Electron desktop app. Open
            Fintheon from your Applications folder to use this feature.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-[var(--fintheon-accent)]/60" />
        <span className="text-[14px] font-semibold text-white tracking-tight">
          Website Blocker
        </span>
      </div>

      {/* Status card */}
      <div
        className={`rounded-lg border p-5 transition-colors ${
          state.blocked
            ? "border-red-500/20 bg-red-500/5"
            : "border-[var(--fintheon-accent)]/10 bg-[rgba(10,10,0,0.4)]"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {state.blocked ? (
              <Shield className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldOff className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-white">
                {state.isLoading
                  ? "Checking status..."
                  : state.blocked
                    ? "TopStepX is blocked"
                    : "TopStepX is accessible"}
              </div>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed max-w-md">
                {state.blocked
                  ? "All TopStepX domains are blocked at the system level. You cannot access topstepx.com, topstep.com, or projectx.com in any browser or application."
                  : "TopStepX websites are currently accessible. Enable blocking to prevent access across all browsers and apps on this computer."}
              </p>
              {state.error && (
                <p className="text-[11px] text-red-400 mt-2">{state.error}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling || state.isLoading}
            className={`shrink-0 px-4 py-2 rounded-md text-[12px] font-semibold transition-all ${
              state.blocked
                ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20"
                : "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/25 border border-[var(--fintheon-accent)]/20"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {toggling ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {state.blocked ? "Unblocking..." : "Blocking..."}
              </span>
            ) : state.blocked ? (
              "Unblock"
            ) : (
              "Block Now"
            )}
          </button>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-lg border border-[var(--fintheon-accent)]/10 p-5 bg-[rgba(10,10,0,0.4)] space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-[var(--fintheon-accent)]/60" />
          <span className="text-[13px] font-semibold text-white">
            How it works
          </span>
        </div>
        <ul className="space-y-2 text-[11px] text-gray-500 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-[var(--fintheon-accent)]/60 mt-0.5">1.</span>
            <span>
              Blocking writes entries to your{" "}
              <code className="text-[var(--fintheon-accent)]/80 bg-[var(--fintheon-accent)]/5 px-1 rounded">
                /etc/hosts
              </code>{" "}
              file, redirecting TopStepX domains to{" "}
              <code className="text-[var(--fintheon-accent)]/80 bg-[var(--fintheon-accent)]/5 px-1 rounded">
                0.0.0.0
              </code>
              . This affects all browsers and apps.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--fintheon-accent)]/60 mt-0.5">2.</span>
            <span>
              Enabling blocking requires your macOS admin password (one-time via
              system dialog).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--fintheon-accent)]/60 mt-0.5">3.</span>
            <span>
              DNS cache is flushed automatically so the block takes effect
              immediately.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--fintheon-accent)]/60 mt-0.5">4.</span>
            <span>
              Unblocking restores your{" "}
              <code className="text-[var(--fintheon-accent)]/80 bg-[var(--fintheon-accent)]/5 px-1 rounded">
                /etc/hosts
              </code>{" "}
              file to its original state.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
