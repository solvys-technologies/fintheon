// [claude-code 2026-05-13] Website Blocker — universal blocker with customizable domain list
// 3 layers: /etc/hosts (DNS), /etc/resolver/ (DNS override), Electron webRequest (in-app iframes/webviews)
import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  ShieldOff,
  RefreshCw,
  Lock,
  Globe,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import Toggle from "../Toggle";
import { useSettings } from "../../contexts/SettingsContext";

interface BlockerApi {
  enable: () => Promise<unknown>;
  disable: () => Promise<unknown>;
  getStatus: () => Promise<{
    blocked: boolean;
    layers: { hosts: boolean; resolver: boolean };
  }>;
  getDomains: () => Promise<{ domains: string[] }>;
  setDomains: (
    domains: string[],
  ) => Promise<{ ok: boolean; domains?: string[]; reason?: string }>;
}

interface BlockerState {
  blocked: boolean;
  layers: { hosts: boolean; resolver: boolean };
  isLoading: boolean;
  error: string | null;
}

function getBlockerApi(): BlockerApi | null {
  const e = window as unknown as { electron?: { blocker?: BlockerApi } };
  return e.electron?.blocker ?? null;
}

function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/\/.*$/, "");
  s = s.replace(/^www\./, "");
  if (!s.includes(".") || s.endsWith(".")) return null;
  return s;
}

export function BlockerTab() {
  const {
    lockoutAutoBlockOutsideTradingWindow,
    setLockoutAutoBlockOutsideTradingWindow,
  } = useSettings();
  const [state, setState] = useState<BlockerState>({
    blocked: false,
    layers: { hosts: false, resolver: false },
    isLoading: true,
    error: null,
  });
  const [domains, setDomains] = useState<string[]>([]);
  const [toggling, setToggling] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
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
      const [statusResult, domainsResult] = await Promise.all([
        api.getStatus(),
        api.getDomains(),
      ]);
      setState({
        blocked: statusResult.blocked,
        layers: statusResult.layers ?? { hosts: false, resolver: false },
        isLoading: false,
        error: null,
      });
      setDomains(domainsResult.domains);
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
    loadAll();
  }, [loadAll]);

  const handleAddDomain = () => {
    setDomainError(null);
    const normalized = normalizeDomain(newDomain);
    if (!normalized) {
      setDomainError("Enter a valid domain (e.g. example.com)");
      return;
    }
    if (domains.includes(normalized)) {
      setDomainError(`"${normalized}" is already in the list`);
      return;
    }
    setDomains((prev) => [...prev, normalized]);
    setNewDomain("");
  };

  const handleRemoveDomain = (domain: string) => {
    setDomains((prev) => prev.filter((d) => d !== domain));
  };

  const handleSaveDomains = async () => {
    const api = getBlockerApi();
    if (!api) return;
    if (domains.length === 0) {
      setDomainError("At least one domain is required to block");
      return;
    }
    setSaving(true);
    setDomainError(null);
    try {
      const result = await api.setDomains(domains);
      if (!result.ok) {
        setDomainError(result.reason ?? "Failed to save domains");
      }
    } catch (err) {
      setDomainError(
        err instanceof Error ? err.message : "Failed to save domains",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    const api = getBlockerApi();
    if (!api) return;
    setToggling(true);
    try {
      if (state.blocked) {
        await api.disable();
      } else {
        // Save current domain list first, then enable
        await api.setDomains(domains);
        await api.enable();
      }
      await loadAll();
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
  const layerCount = [state.layers.hosts, state.layers.resolver].filter(
    Boolean,
  ).length;
  const autoLockPolicy = (
    <div className="rounded-lg border border-[var(--fintheon-accent)]/10 p-5 bg-[rgba(10,10,0,0.4)]">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-white">
            Desk Plan Auto-Lock
          </div>
          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed max-w-md">
            Lock trading outside active Desk Plan windows.
          </p>
        </div>
        <Toggle
          enabled={lockoutAutoBlockOutsideTradingWindow}
          onChange={setLockoutAutoBlockOutsideTradingWindow}
        />
      </div>
    </div>
  );

  if (!isElectron) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[var(--fintheon-accent)]/60" />
          <span className="text-[14px] font-semibold text-white tracking-tight">
            Website Blocker
          </span>
        </div>
        {autoLockPolicy}
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

      {autoLockPolicy}

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
                    ? `Blocked (${layerCount}/2 layers)`
                    : "Not blocking"}
              </div>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed max-w-md">
                {state.blocked
                  ? `${domains.length} domain${domains.length === 1 ? "" : "s"} blocked system-wide. No browser, PWA, or app can reach them.`
                  : "Toggle blocking on to prevent access to the domains below across all browsers and applications on this computer."}
              </p>
              {state.error && (
                <p className="text-[11px] text-red-400 mt-2">{state.error}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling || state.isLoading || domains.length === 0}
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

      {/* Domain list manager */}
      <div className="rounded-lg border border-[var(--fintheon-accent)]/10 p-5 bg-[rgba(10,10,0,0.4)] space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[var(--fintheon-accent)]/60" />
          <span className="text-[13px] font-semibold text-white">
            Blocked Domains
          </span>
          <span className="text-[10px] text-gray-500 ml-1">
            ({domains.length})
          </span>
        </div>

        {/* Add domain input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => {
              setNewDomain(e.target.value);
              setDomainError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddDomain();
            }}
            placeholder="domain.com"
            className="flex-1 px-3 py-2 rounded-md text-[12px] bg-black/20 border border-[var(--fintheon-accent)]/15 text-white placeholder-gray-600 focus:outline-none focus:border-[var(--fintheon-accent)]/40 transition-colors"
          />
          <button
            onClick={handleAddDomain}
            className="shrink-0 px-3 py-2 rounded-md text-[11px] font-semibold bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/25 border border-[var(--fintheon-accent)]/20 transition-all"
          >
            <span className="flex items-center gap-1.5">
              <Plus className="w-3 h-3" />
              Add
            </span>
          </button>
        </div>
        {domainError && (
          <p className="text-[10px] text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {domainError}
          </p>
        )}

        {/* Domain list */}
        {(domains.length > 0 && (
          <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1">
            {domains.map((domain) => (
              <div
                key={domain}
                className="flex items-center justify-between px-3 py-2 rounded-md bg-black/10 border border-[var(--fintheon-accent)]/5 hover:border-[var(--fintheon-accent)]/15 transition-colors group"
              >
                <span className="text-[12px] text-gray-300 font-mono">
                  {domain}
                </span>
                <button
                  onClick={() => handleRemoveDomain(domain)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/15 text-gray-500 hover:text-red-400 transition-all"
                  title="Remove domain"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )) || (
          <p className="text-[11px] text-gray-500 italic">
            No domains configured. Add at least one domain above, then save.
          </p>
        )}

        {/* Save button */}
        <div className="flex justify-end gap-2 pt-1 border-t border-[var(--fintheon-accent)]/5">
          <button
            onClick={handleSaveDomains}
            disabled={saving}
            className="px-4 py-2 rounded-md text-[12px] font-semibold bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/25 border border-[var(--fintheon-accent)]/20 disabled:opacity-40 transition-all"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Saving...
              </span>
            ) : (
              "Save List"
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
            <span className="text-[var(--fintheon-accent)]/60 mt-0.5 shrink-0">
              1.
            </span>
            <span>
              Add any domain to the list above. Subdomains are automatically
              included — e.g. blocking{" "}
              <code className="text-[var(--fintheon-accent)]/80 bg-[var(--fintheon-accent)]/5 px-1 rounded">
                twitter.com
              </code>{" "}
              also blocks{" "}
              <code className="text-[var(--fintheon-accent)]/80 bg-[var(--fintheon-accent)]/5 px-1 rounded">
                x.com
              </code>
              .
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--fintheon-accent)]/60 mt-0.5 shrink-0">
              2.
            </span>
            <span>
              <strong className="text-gray-400">DNS Block</strong> writes to{" "}
              <code className="text-[var(--fintheon-accent)]/80 bg-[var(--fintheon-accent)]/5 px-1 rounded">
                /etc/hosts
              </code>{" "}
              — works on standard macOS.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--fintheon-accent)]/60 mt-0.5 shrink-0">
              3.
            </span>
            <span>
              <strong className="text-gray-400">DNS Override</strong> creates{" "}
              <code className="text-[var(--fintheon-accent)]/80 bg-[var(--fintheon-accent)]/5 px-1 rounded">
                /etc/resolver/
              </code>{" "}
              entries that override custom DNS services (Control D, NextDNS,
              etc.).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--fintheon-accent)]/60 mt-0.5 shrink-0">
              4.
            </span>
            <span>
              <strong className="text-gray-400">In-app filter</strong> catches
              blocked domains inside Fintheon's own webviews and iframes.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--fintheon-accent)]/60 mt-0.5 shrink-0">
              5.
            </span>
            <span>
              Requires macOS admin password (one-time system dialog). All three
              layers activate and deactivate together.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
