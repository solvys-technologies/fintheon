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
} from "lucide-react";
import Toggle from "../Toggle";
import { useSettings } from "../../contexts/SettingsContext";
import {
  DEFAULT_BLOCKER_PLATFORM_ID,
  domainsFromUrl,
  getBlockerApi,
  loadBlockerCustomDomains,
  loadBlockerQuickTarget,
  mergeDomainLists,
  notifyBlockerStateUpdated,
  normalizeDomain,
  saveBlockerQuickTarget,
  saveBlockerCustomDomains,
  type BlockerQuickTarget,
} from "../../lib/platform-blocker";
import { SettingsActionStatus } from "./SettingsActionStatus";

interface LockoutElectron {
  checkAccessibility: () => Promise<{ granted: boolean }>;
  requestAccessibility: () => Promise<{ granted: boolean }>;
}

interface BlockerState {
  blocked: boolean;
  layers: { hosts: boolean; resolver: boolean; runtime?: boolean };
  isLoading: boolean;
  error: string | null;
}

export function BlockerTab() {
  const {
    lockoutAutoBlockOutsideTradingWindow,
    setLockoutAutoBlockOutsideTradingWindow,
    lockoutPermission,
    setLockoutPermission,
    proposerIframeSources,
  } = useSettings();
  const [accessibilityCheckLoading, setAccessibilityCheckLoading] =
    useState(false);
  const [state, setState] = useState<BlockerState>({
    blocked: false,
    layers: { hosts: false, resolver: false },
    isLoading: true,
    error: null,
  });
  const [domains, setDomains] = useState<string[]>(() =>
    loadBlockerCustomDomains(),
  );
  const [toggling, setToggling] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [quickTarget, setQuickTarget] = useState<BlockerQuickTarget>(() => {
    return (
      loadBlockerQuickTarget() ?? {
        mode: "platform",
        platformId: DEFAULT_BLOCKER_PLATFORM_ID,
        url: "",
      }
    );
  });
  const [quickTargetSaving, setQuickTargetSaving] = useState(false);
  const [quickTargetError, setQuickTargetError] = useState<string | null>(null);

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
      const statusResult = await api.getStatus();
      setState({
        blocked: statusResult.blocked,
        layers: statusResult.layers ?? { hosts: false, resolver: false },
        isLoading: false,
        error: null,
      });
      setDomains(loadBlockerCustomDomains());
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
    setSaving(true);
    setDomainError(null);
    try {
      const customDomains = mergeDomainLists(domains);
      const nextCombinedDomains = mergeDomainLists(
        quickTargetDomains,
        customDomains,
      );
      saveBlockerCustomDomains(customDomains);
      setDomains(customDomains);
      const result = await api.setDomains(nextCombinedDomains);
      if (!result.ok) {
        setDomainError(result.reason ?? "Failed to save domains");
      } else {
        notifyBlockerStateUpdated();
      }
    } catch (err) {
      setDomainError(
        err instanceof Error ? err.message : "Failed to save domains",
      );
    } finally {
      setSaving(false);
    }
  };

  const quickTargetSource =
    proposerIframeSources.find(
      (source) => source.id === quickTarget.platformId,
    ) ??
    proposerIframeSources.find(
      (source) => source.id === DEFAULT_BLOCKER_PLATFORM_ID,
    ) ??
    proposerIframeSources[0];
  const quickTargetDomains = domainsFromUrl(quickTargetSource?.url ?? "");
  const combinedDomains = mergeDomainLists(quickTargetDomains, domains);

  const persistQuickTarget = () => {
    setQuickTargetError(null);
    const targetToSave: BlockerQuickTarget = {
      mode: "platform",
      platformId:
        quickTargetSource?.id ??
        quickTarget.platformId ??
        DEFAULT_BLOCKER_PLATFORM_ID,
      url: "",
    };
    const nextDomains = domainsFromUrl(quickTargetSource?.url ?? "");
    const nextCombinedDomains = mergeDomainLists(nextDomains, domains);
    if (nextDomains.length === 0) {
      setQuickTargetError("Choose a platform with a valid URL.");
      return null;
    }
    saveBlockerQuickTarget(targetToSave);
    setQuickTarget(targetToSave);
    return { target: targetToSave, domains: nextCombinedDomains };
  };

  const handleSaveQuickTarget = async () => {
    const saved = persistQuickTarget();
    const api = getBlockerApi();
    if (!saved || !api || !state.blocked) return;
    setQuickTargetSaving(true);
    try {
      saveBlockerCustomDomains(domains);
      const result = await api.setDomains(saved.domains);
      if (!result.ok) {
        setQuickTargetError(
          result.reason ?? "Failed to update blocker domains",
        );
        return;
      }
      notifyBlockerStateUpdated();
      await loadAll();
    } finally {
      setQuickTargetSaving(false);
    }
  };

  const handleBlockQuickTargetInApp = async () => {
    const api = getBlockerApi();
    if (!api) return;
    const saved = persistQuickTarget();
    if (!saved) return;
    setQuickTargetSaving(true);
    try {
      saveBlockerCustomDomains(domains);
      const result = await api.setDomains(saved.domains);
      if (!result.ok) {
        setQuickTargetError(result.reason ?? "Failed to save target domains");
        return;
      }
      await api.enableFast();
      notifyBlockerStateUpdated();
      await loadAll();
    } catch (err) {
      setQuickTargetError(
        err instanceof Error ? err.message : "Failed to block in-app",
      );
    } finally {
      setQuickTargetSaving(false);
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
        saveBlockerCustomDomains(domains);
        await api.setDomains(combinedDomains);
        await api.enable();
      }
      notifyBlockerStateUpdated();
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
  const layerCount = [
    state.layers.hosts,
    state.layers.resolver,
    state.layers.runtime ?? false,
  ].filter(Boolean).length;
  const runtimeOnlyBlocked =
    state.blocked &&
    !!state.layers.runtime &&
    !state.layers.hosts &&
    !state.layers.resolver;
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

      <div className="rounded-lg border border-[var(--fintheon-accent)]/10 p-5 bg-[rgba(10,10,0,0.4)] space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[var(--fintheon-accent)]/60" />
              <span className="text-[13px] font-semibold text-white">
                Blocked Platform
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed max-w-md">
              Choose one platform from the available platform dropdown. Fintheon
              blocks that platform plus the custom domains below.
            </p>
          </div>
        </div>

        <select
          value={quickTargetSource?.id ?? DEFAULT_BLOCKER_PLATFORM_ID}
          onChange={(event) =>
            setQuickTarget({
              mode: "platform",
              platformId: event.target.value,
              url: "",
            })
          }
          className="w-full px-3 py-2 rounded-md text-[12px] bg-black/20 border border-[var(--fintheon-accent)]/15 text-white focus:outline-none focus:border-[var(--fintheon-accent)]/40"
        >
          {proposerIframeSources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label} — {source.url}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-start justify-end gap-3 text-right">
          <div className="flex min-w-0 flex-1 flex-col items-end">
            <SettingsActionStatus
              label={
                quickTargetDomains.length > 0 ? "Platform Ready" : "No Platform"
              }
              detail={
                quickTargetDomains.length > 0
                  ? `${quickTargetDomains.join(", ")}${domains.length > 0 ? ` + ${domains.length} custom` : ""}`
                  : "No valid domains detected"
              }
              tone={quickTargetDomains.length > 0 ? "success" : "muted"}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleSaveQuickTarget}
              className="px-3 py-1.5 rounded-md text-[11px] font-semibold bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/20 border border-[var(--fintheon-accent)]/15 transition-all"
            >
              Save Platform
            </button>
            <button
              onClick={handleBlockQuickTargetInApp}
              disabled={quickTargetSaving || quickTargetDomains.length === 0}
              className="px-3 py-1.5 rounded-md text-[11px] font-semibold bg-red-500/12 text-red-300 hover:bg-red-500/20 border border-red-500/15 disabled:opacity-40 transition-all"
            >
              {quickTargetSaving ? "Blocking..." : "Block In-App"}
            </button>
          </div>
        </div>
        {quickTargetError && (
          <div className="flex justify-end">
            <SettingsActionStatus
              label="Target Error"
              detail={quickTargetError}
              tone="error"
            />
          </div>
        )}
      </div>

      {/* Lockout Accessibility Permission */}
      <div className="rounded-lg border border-[var(--fintheon-accent)]/10 p-5 bg-[rgba(10,10,0,0.4)]">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white">
              Accessibility Permission
            </div>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed max-w-md">
              Pre-authorizes Fintheon so locking works without a password
              prompt.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            <button
              onClick={async () => {
                setAccessibilityCheckLoading(true);
                try {
                  const el = (window as any).electron;
                  const result = el?.lockout?.requestAccessibility
                    ? await el.lockout.requestAccessibility()
                    : el?.lockout?.checkAccessibility
                      ? await el.lockout.checkAccessibility()
                      : null;
                  if (result && typeof result.granted === "boolean") {
                    setLockoutPermission(result.granted ? "granted" : "denied");
                  }
                } catch {
                } finally {
                  setAccessibilityCheckLoading(false);
                }
              }}
              disabled={accessibilityCheckLoading}
              className="px-3 py-1.5 rounded-md text-[11px] font-semibold bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/25 border border-[var(--fintheon-accent)]/20 disabled:opacity-40 transition-all"
            >
              {accessibilityCheckLoading ? "Checking..." : "Grant Permission"}
            </button>
            <SettingsActionStatus
              label={
                lockoutPermission === "granted"
                  ? "Granted"
                  : lockoutPermission === "denied"
                    ? "Not Granted"
                    : "Not Required"
              }
              detail="Accessibility status"
              tone={
                lockoutPermission === "granted"
                  ? "success"
                  : lockoutPermission === "denied"
                    ? "error"
                    : "muted"
              }
            />
          </div>
        </div>
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
                    ? `Blocked (${layerCount}/3 layers)`
                    : "Not blocking"}
              </div>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed max-w-md">
                {state.blocked
                  ? runtimeOnlyBlocked
                    ? `${combinedDomains.length} domain${combinedDomains.length === 1 ? "" : "s"} blocked in Fintheon runtime.`
                    : `${combinedDomains.length} domain${combinedDomains.length === 1 ? "" : "s"} blocked system-wide. No browser, PWA, or app can reach them.`
                  : "Blocking is limited to the selected platform and any custom domains below."}
              </p>
              {state.error && (
                <p className="text-[11px] text-red-400 mt-2">{state.error}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            <button
              onClick={handleToggle}
              disabled={
                toggling || state.isLoading || combinedDomains.length === 0
              }
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
            <SettingsActionStatus
              label={
                state.isLoading
                  ? "Checking"
                  : state.blocked
                    ? "Blocked"
                    : "Not Blocking"
              }
              detail={`${layerCount}/3 layers active`}
              tone={state.blocked ? "error" : "muted"}
            />
          </div>
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
            Custom Blocked Domains
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
          <div className="flex justify-end">
            <SettingsActionStatus
              label="Domain Error"
              detail={domainError}
              tone="error"
            />
          </div>
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
          <div className="flex justify-end">
            <SettingsActionStatus
              label="Clean Slate"
              detail="No custom URL domains set."
            />
          </div>
        )}

        {/* Save button */}
        <div className="flex flex-col items-end justify-end gap-1 pt-1 text-right">
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
          {saving && (
            <SettingsActionStatus
              label="Saving"
              detail="Updating blocker domain list."
              tone="warning"
            />
          )}
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
              Pick one platform from the dropdown. TopStepX is the default
              clean-slate platform.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--fintheon-accent)]/60 mt-0.5 shrink-0">
              2.
            </span>
            <span>
              Add only the extra domains you specifically want blocked.
              Subdomains of each saved domain are included.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--fintheon-accent)]/60 mt-0.5 shrink-0">
              3.
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
              4.
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
              5.
            </span>
            <span>
              <strong className="text-gray-400">In-app filter</strong> catches
              blocked domains inside Fintheon's own webviews and shows the Desk
              Block screen instead of the blank white blocked pane.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--fintheon-accent)]/60 mt-0.5 shrink-0">
              6.
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
