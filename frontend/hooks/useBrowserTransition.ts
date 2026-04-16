// [claude-code 2026-04-10] S9-T3: Extracted browser transition from MainLayout
import { useState, useCallback, useEffect, useRef } from "react";
import type { TradingPlatform } from "../components/TradingBrowser";

interface UseBrowserTransitionParams {
  defaultPlatform: TradingPlatform;
}

export function useBrowserTransition({
  defaultPlatform,
}: UseBrowserTransitionParams) {
  const [topStepXEnabled, setTopStepXEnabled] = useState(false);
  const [browserTransitioning, setBrowserTransitioning] = useState(false);
  const [browserVisible, setBrowserVisible] = useState(false);
  const [selectedPlatform, setSelectedPlatform] =
    useState<TradingPlatform>(defaultPlatform);
  const [secondaryPlatform, setSecondaryPlatform] =
    useState<TradingPlatform>("research");
  const userPickedPlatform = useRef(false);

  // Sync when settings default changes (unless user already picked manually)
  useEffect(() => {
    if (!userPickedPlatform.current) {
      setSelectedPlatform(defaultPlatform);
    }
  }, [defaultPlatform]);

  const setSelectedPlatformTracked = useCallback((p: TradingPlatform) => {
    userPickedPlatform.current = true;
    setSelectedPlatform(p);
  }, []);
  const [splitBrowserView, setSplitBrowserView] = useState(false);

  // Smooth browser open/close transition
  const handleBrowserToggle = useCallback(() => {
    if (browserTransitioning) return;
    setBrowserTransitioning(true);
    if (topStepXEnabled) {
      // Closing: fade out browser, then swap
      setBrowserVisible(false);
      setTimeout(() => {
        setTopStepXEnabled(false);
        setBrowserTransitioning(false);
      }, 300);
    } else {
      // Opening: swap immediately, then fade in
      setTopStepXEnabled(true);
      setBrowserVisible(true);
      setTimeout(() => {
        setBrowserTransitioning(false);
      }, 400);
    }
  }, [topStepXEnabled, browserTransitioning]);

  const handleBrowserEnable = useCallback(() => {
    if (topStepXEnabled || browserTransitioning) return;
    setBrowserTransitioning(true);
    setTopStepXEnabled(true);
    setBrowserVisible(true);
    setTimeout(() => {
      setBrowserTransitioning(false);
    }, 400);
  }, [topStepXEnabled, browserTransitioning]);

  return {
    topStepXEnabled,
    browserTransitioning,
    browserVisible,
    selectedPlatform,
    setSelectedPlatform: setSelectedPlatformTracked,
    secondaryPlatform,
    setSecondaryPlatform,
    splitBrowserView,
    setSplitBrowserView,
    handleBrowserToggle,
    handleBrowserEnable,
  };
}
