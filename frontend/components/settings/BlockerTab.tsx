// [claude-code 2026-05-13] TopStepX PWA Blocker — settings tab for enabling/disabling system-wide blocking
// 3 layers: /etc/hosts (DNS), /etc/resolver/ (DNS override for custom resolvers), Electron webRequest (in-app)
import { useState, useEffect, useCallback } from "react";
import { Shield, ShieldOff, RefreshCw, Lock, Globe } from "lucide-react";

interface BlockerStatus {
  blocked: boolean;
  layers?: { hosts: boolean; resolver: boolean };
}

interface BlockerState {
  blocked: boolean;
  layers: { hosts: boolean; resolver: boolean };
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
          getStatus: () => Promise<BlockerStatus>;
        };
      };
    }
  ).electron;
  return e?.blocker ?? null;
}

export function BlockerTab() {
  const [state, setState] = useState<BlockerState>({
    blocked: false,
    layers: { hosts: false, resolver: false },
    isLoading: true,
    error: null,
  });
  const [toggling, setToggling] = useState(false);

  const refresh = useCallback(async () => {
    const api = getBlockerApi();
    if (!api) {
      setState({
        blocked: false,
        layers: { hosts: false, resolver: false },
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
        layers: result.layers ?? { hosts: false, resolver: false },
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState({
        blocked: false,
        layers: { hosts: false, resolver: false },
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

  const layerCount = [state.layers.hosts, state.layers.resolver].filter(
    Boolean,
  ).length;

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
                  ? `All TopStepX domains are blocked at the system level (${layerCount}/2 layers active). You cannot access topstepx.com, topstep.com, or projectx.com in any browser, app, or PWA.`
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

      {/* Layer status indicators */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className={`rounded-lg border p-3 transition-colors ${
            state.layers.hosts
              ? "border-red-500/20 bg-red-500/5"
              : "border-[var(--fintheon-accent)]/10 bg-[rgba(10,10,0,0.4)]"
          }`}
        >
          <div className="flex items-center gap-2">
            <Globe
              className={`w-3.5 h-3.5 ${state.layers.hosts ? "text-red-400" : "text-gray-500"}`}
            />
            <span
              className={`text-[11px] font-medium ${state.layers.hosts ? "text-red-400" : "text-gray-400"}`}
            >
              DNS Block
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
            {state.layers.hosts
              ? "/etc/hosts — active"
              : "/etc/hosts — inactive"}
          </p>
        </div>
        <div
          className={`rounded-lg border p-3 transition-colors ${
            state.layers.resolver
              ? "border-red-500/20 bg-red-500/5"
              : "border-[var(--fintheon-accent)]/10 bg-[rgba(10,10,0,0.4)]"
          }`}
        >
          <div className="flex items-center gap-2">
            <Lock
              className={`w-3.5 h-3.5 ${state.layers.resolver ? "text-red-400" : "text-gray-500"}`}
            />
            <span
              className={`text-[11px] font-medium ${state.layers.resolver ? "text-red-400" : "text-gray-400"}`}
            >
              DNS Override
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
            {state.layers.resolver
              ? "/etc/resolver/ — active"
              : "/etc/resolver/ — inactive"}
          </p>
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
            <span className="text-[var(--fintheon-accent)]/60 mt-0.5 shrink-0">
              1.
            </span>
            <span>
              <strong className="text-gray-400">DNS Block:</strong> Writes to{" "}
              <code className="text-[var(--fintheon-accent)]/80 bg-[var(--fintheon-accent)]/5 px-1 rounded">
                /etc/hosts
              </code>
              , redirecting domains to{" "}
              <code className="text-[var(--fintheon-accent)]/80 bg-[var(--fintheon-accent)]/5 px-1 rounded">
                0.0.0.0
              </code>
              . Works on standard macOS configurations.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--fintheon-accent)]/60 mt-0.5 shrink-0">
              2.
            </span>
            <span>
              <strong className="text-gray-400">DNS Override:</strong> Creates{" "}
              <code className="text-[var(--fintheon-accent)]/80 bg-[var(--fintheon-accent)]/5 px-1 rounded">
                /etc/resolver/
              </code>{" "}
              per-domain overrides that take priority over custom DNS services
              (NextDNS, Control D, etc.).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--fintheon-accent)]/60 mt-0.5 shrink-0">
              3.
            </span>
            <span>
              Both layers activate/deactivate together. Requires your macOS
              admin password (one-time via system dialog).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--fintheon-accent)]/60 mt-0.5 shrink-0">
              4.
            </span>
            <span>
              <strong className="text-gray-400">Blocks:</strong>{" "}
              <code className="text-[var(--fintheon-accent)]/80 bg-[var(--fintheon-accent)]/5 px-1 rounded">
                topstepx.com
              </code>
              ,{" "}
              <code className="text-[var(--fintheon-accent)]/80 bg-[var(--fintheon-accent)]/5 px-1 rounded">
                topstep.com
              </code>
              ,{" "}
              <code className="text-[var(--fintheon-accent)]/80 bg-[var(--fintheon-accent)]/5 px-1 rounded">
                projectx.com
              </code>{" "}
              and all subdomains — in every browser, PWA, and application.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
