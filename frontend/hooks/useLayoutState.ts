// [claude-code 2026-04-10] S9-T3: Extracted layout state from MainLayout
import { useState, useCallback, useEffect } from "react";
import type { PanelPosition } from "../components/layout/DraggablePanel";

type LayoutOption = "tickers-only" | "combined";

interface UseLayoutStateParams {
  topStepXEnabled: boolean;
  defaultLayout: LayoutOption;
  setAutoDnd: (v: boolean) => void;
  flushQueue: () => void;
}

export function useLayoutState({
  topStepXEnabled,
  defaultLayout,
  setAutoDnd,
  flushQueue,
}: UseLayoutStateParams) {
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [missionControlCollapsed, setMissionControlCollapsedRaw] =
    useState(false);
  const [riskFlowCollapsed, setRiskFlowCollapsed] = useState(false);
  // 4c: Link Strategium ↔ RiskFlow collapse — always in sync
  const setMissionControlCollapsed = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      setMissionControlCollapsedRaw((prev) => {
        const next = typeof v === "function" ? v(prev) : v;
        setRiskFlowCollapsed(next);
        return next;
      });
    },
    [],
  );
  const [tapeCollapsed, setTapeCollapsed] = useState(false);
  const [combinedPanelCollapsed, setCombinedPanelCollapsed] = useState(false);
  const [combinedTapeCollapsed, setCombinedTapeCollapsed] = useState(false);
  const [layoutOption, setLayoutOption] = useState<LayoutOption>(defaultLayout);
  const [prevLayoutOption, setPrevLayoutOption] = useState<LayoutOption | null>(
    null,
  );
  const [missionControlPosition, setMissionControlPosition] =
    useState<PanelPosition>("right");
  const [tapePosition, setTapePosition] = useState<PanelPosition>("right");
  const [sidebarOverlayVisible, setSidebarOverlayVisible] = useState(false);

  // Auto-DND: activate when trading mode is on, flush queue when it turns off
  useEffect(() => {
    setAutoDnd(topStepXEnabled);
    if (!topStepXEnabled) {
      flushQueue();
    }
  }, [topStepXEnabled, setAutoDnd, flushQueue]);

  // Reset layout when TopStepX is toggled
  useEffect(() => {
    if (topStepXEnabled) {
      setMissionControlPosition("right");
      setTapePosition("right");
      setLayoutOption("combined");
    } else {
      setMissionControlPosition("right");
      setTapePosition("right");
      setMissionControlCollapsed(false);
      setTapeCollapsed(false);
    }
  }, [topStepXEnabled]);

  useEffect(() => {
    if (layoutOption === "combined" && prevLayoutOption !== layoutOption) {
      setCombinedPanelCollapsed(false);
    }
    setPrevLayoutOption(layoutOption);
  }, [layoutOption, prevLayoutOption]);

  return {
    layoutEditMode,
    setLayoutEditMode,
    missionControlCollapsed,
    setMissionControlCollapsed,
    tapeCollapsed,
    setTapeCollapsed,
    combinedPanelCollapsed,
    setCombinedPanelCollapsed,
    combinedTapeCollapsed,
    setCombinedTapeCollapsed,
    layoutOption,
    setLayoutOption,
    missionControlPosition,
    setMissionControlPosition,
    tapePosition,
    setTapePosition,
    riskFlowCollapsed,
    setRiskFlowCollapsed,
    sidebarOverlayVisible,
    setSidebarOverlayVisible,
  };
}
