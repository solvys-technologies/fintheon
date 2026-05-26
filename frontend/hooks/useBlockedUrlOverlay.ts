import { useCallback, useEffect, useMemo, useState } from "react";
import { useSettings } from "../contexts/SettingsContext";
import {
  DEFAULT_BLOCKER_PLATFORM_ID,
  domainSetsIntersect,
  domainsFromUrl,
  getBlockerApi,
  loadBlockerCustomDomains,
  loadBlockerQuickTarget,
  mergeDomainLists,
  resolveBlockerTarget,
  type BlockerQuickTarget,
} from "../lib/platform-blocker";

interface BlockerOverlayResult {
  shouldOverlay: boolean;
}

interface CheckedBlockState {
  key: string;
  blocked: boolean;
}

export function useBlockedUrlOverlay(activeUrl: string): BlockerOverlayResult {
  const { proposerIframeSources } = useSettings();
  const [quickTarget, setQuickTarget] = useState<BlockerQuickTarget | null>(
    () => loadBlockerQuickTarget(),
  );
  const [customDomains, setCustomDomains] = useState<string[]>(() =>
    loadBlockerCustomDomains(),
  );
  const activeDomains = useMemo(() => domainsFromUrl(activeUrl), [activeUrl]);
  const activeDomainKey = activeDomains.join("|");
  const configuredDomains = useMemo(() => {
    const target = resolveBlockerTarget({
      target: quickTarget,
      sources: proposerIframeSources,
      selectedPlatform: quickTarget?.platformId || DEFAULT_BLOCKER_PLATFORM_ID,
    });
    return mergeDomainLists(target?.domains ?? [], customDomains);
  }, [customDomains, proposerIframeSources, quickTarget]);
  const isConfiguredTarget =
    activeDomains.length > 0 &&
    domainSetsIntersect(activeDomains, configuredDomains);
  const [checked, setChecked] = useState<CheckedBlockState>({
    key: "",
    blocked: false,
  });

  const checkBlocker = useCallback(async () => {
    const key = activeDomainKey;
    if (!key) {
      setChecked({ key, blocked: false });
      return;
    }
    const api = getBlockerApi();
    if (!api) {
      setChecked({ key, blocked: false });
      return;
    }
    try {
      const [status, domainsResult] = await Promise.all([
        api.getStatus(),
        api.getDomains(),
      ]);
      const blockedDomains = mergeDomainLists(
        domainsResult.domains ?? status.domains ?? [],
      );
      const blocked =
        !!status.blocked && domainSetsIntersect(activeDomains, blockedDomains);
      setChecked({ key, blocked });
    } catch {
      setChecked({ key, blocked: false });
    }
  }, [activeDomainKey, activeDomains]);

  useEffect(() => {
    setChecked((prev) =>
      prev.key === activeDomainKey ? prev : { key: "", blocked: false },
    );
    void checkBlocker();
  }, [activeDomainKey, checkBlocker]);

  useEffect(() => {
    const refreshTargets = () => {
      setQuickTarget(loadBlockerQuickTarget());
      setCustomDomains(loadBlockerCustomDomains());
      setChecked({ key: "", blocked: false });
      void checkBlocker();
    };
    window.addEventListener("fintheon:blocker-state-updated", refreshTargets);
    window.addEventListener(
      "fintheon:blocker-quick-target-updated",
      refreshTargets,
    );
    window.addEventListener(
      "fintheon:blocker-custom-domains-updated",
      refreshTargets,
    );
    window.addEventListener("storage", refreshTargets);
    return () => {
      window.removeEventListener(
        "fintheon:blocker-state-updated",
        refreshTargets,
      );
      window.removeEventListener(
        "fintheon:blocker-quick-target-updated",
        refreshTargets,
      );
      window.removeEventListener(
        "fintheon:blocker-custom-domains-updated",
        refreshTargets,
      );
      window.removeEventListener("storage", refreshTargets);
    };
  }, [checkBlocker]);

  const isPending = checked.key !== activeDomainKey;
  const shouldOverlay = checked.blocked || (isPending && isConfiguredTarget);
  return { shouldOverlay };
}
