import { useCallback, useEffect, useMemo, useState } from "react";
import { useSettings } from "../contexts/SettingsContext";
import type { TradingPlatform } from "../components/TradingBrowser";
import {
  getBlockerApi,
  loadBlockerCustomDomains,
  loadBlockerQuickTarget,
  mergeDomainLists,
  notifyBlockerStateUpdated,
  resolveBlockerTarget,
  sameDomainSet,
  type BlockerQuickTarget,
  type BlockerStatus,
  type ResolvedBlockerTarget,
} from "../lib/platform-blocker";

export interface PlatformBlockerState {
  blocked: boolean;
  runtimeBlocked: boolean;
  activeForTarget: boolean;
  domains: string[];
  target: ResolvedBlockerTarget | null;
  layers: BlockerStatus["layers"];
  loading: boolean;
  error: string | null;
}

const DEFAULT_STATUS: BlockerStatus = {
  blocked: false,
  layers: { hosts: false, resolver: false, runtime: false },
  domains: [],
};

export function usePlatformBlocker(selectedPlatform: TradingPlatform) {
  const { proposerIframeSources } = useSettings();
  const [quickTarget, setQuickTarget] = useState<BlockerQuickTarget | null>(
    () => loadBlockerQuickTarget(),
  );
  const [customDomains, setCustomDomains] = useState<string[]>(() =>
    loadBlockerCustomDomains(),
  );
  const [status, setStatus] = useState<BlockerStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const target = useMemo(() => {
    const resolved = resolveBlockerTarget({
      target: quickTarget,
      sources: proposerIframeSources,
      selectedPlatform,
    });
    if (!resolved) return null;
    return {
      ...resolved,
      domains: mergeDomainLists(resolved.domains, customDomains),
    };
  }, [customDomains, proposerIframeSources, quickTarget, selectedPlatform]);

  const refresh = useCallback(async () => {
    const api = getBlockerApi();
    if (!api) {
      setLoading(false);
      setStatus(DEFAULT_STATUS);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [nextStatus, domainsResult] = await Promise.all([
        api.getStatus(),
        api.getDomains(),
      ]);
      setStatus({
        blocked: !!nextStatus.blocked,
        layers: nextStatus.layers ?? DEFAULT_STATUS.layers,
        domains: domainsResult.domains ?? nextStatus.domains ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const handleTargetUpdate = () => setQuickTarget(loadBlockerQuickTarget());
    const handleCustomDomainsUpdate = () =>
      setCustomDomains(loadBlockerCustomDomains());
    const handleStateUpdate = () => void refresh();
    window.addEventListener(
      "fintheon:blocker-quick-target-updated",
      handleTargetUpdate,
    );
    window.addEventListener(
      "fintheon:blocker-custom-domains-updated",
      handleCustomDomainsUpdate,
    );
    window.addEventListener(
      "fintheon:blocker-state-updated",
      handleStateUpdate,
    );
    window.addEventListener("storage", handleTargetUpdate);
    window.addEventListener("storage", handleCustomDomainsUpdate);
    return () => {
      window.removeEventListener(
        "fintheon:blocker-quick-target-updated",
        handleTargetUpdate,
      );
      window.removeEventListener(
        "fintheon:blocker-custom-domains-updated",
        handleCustomDomainsUpdate,
      );
      window.removeEventListener(
        "fintheon:blocker-state-updated",
        handleStateUpdate,
      );
      window.removeEventListener("storage", handleTargetUpdate);
      window.removeEventListener("storage", handleCustomDomainsUpdate);
    };
  }, [refresh]);

  const blockTargetInApp = useCallback(async () => {
    const api = getBlockerApi();
    if (!api || !target) {
      const message = !api
        ? "Blocker is only available in the desktop app"
        : "Choose a blocker target first";
      setError(message);
      return { ok: false, reason: message };
    }
    try {
      setError(null);
      const result = await api.setDomains(target.domains);
      if (!result.ok) {
        const reason = result.reason ?? "Failed to save blocker target";
        setError(reason);
        return { ok: false, reason };
      }
      await api.enableFast();
      notifyBlockerStateUpdated();
      await refresh();
      return { ok: true, target };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setError(reason);
      return { ok: false, reason };
    }
  }, [refresh, target]);

  const unblockInApp = useCallback(async () => {
    const api = getBlockerApi();
    if (!api) return { ok: false, reason: "Blocker is unavailable" };
    try {
      setError(null);
      if (api.disableFast) {
        await api.disableFast();
      } else {
        await api.disable();
      }
      notifyBlockerStateUpdated();
      await refresh();
      return { ok: true };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setError(reason);
      return { ok: false, reason };
    }
  }, [refresh]);

  const domains = status.domains ?? [];
  const blocked = !!status.blocked;
  const runtimeBlocked = !!status.layers?.runtime;
  const activeForTarget =
    runtimeBlocked && !!target && sameDomainSet(domains, target.domains);

  return {
    state: {
      blocked,
      runtimeBlocked,
      activeForTarget,
      domains,
      target,
      layers: status.layers ?? DEFAULT_STATUS.layers,
      loading,
      error,
    } satisfies PlatformBlockerState,
    blockTargetInApp,
    unblockInApp,
    refresh,
  };
}
