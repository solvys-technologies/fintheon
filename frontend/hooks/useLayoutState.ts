// [claude-code 2026-04-24] S37 fix: decouple missionControlCollapsed from riskFlowCollapsed. The forced sync made the 168px RiskFlow mini-card state unreachable — expanding Strategium from the chevron would reset riskFlowCollapsed=false and skip the mini.
// [claude-code 2026-04-10] S9-T3: Extracted layout state from MainLayout
import { useState, useCallback, useEffect, useRef } from "react";
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
  // [claude-code 2026-04-19] Strategium always boots closed per user request.
  // Persisted state would fight with "restore to last route" — keep the panel
  // explicitly hidden on every boot; user re-opens manually if wanted.
  const [missionControlCollapsed, setMissionControlCollapsed] = useState(true);
  // [S37] Start collapsed=false on boot so users see the RiskFlow feed, not a 168px
  //       mini stub with no feed visible. Toggling from here is explicit — no forced
  //       sync with missionControlCollapsed (that's what made the mini unreachable).
  const [riskFlowCollapsed, setRiskFlowCollapsed] = useState(false);
  const [tapeCollapsed, setTapeCollapsed] = useState(false);
  // [claude-code 2026-04-26] Strategium snaps closed by default per TP — toggle
  // is now in the TopHeader panel-toggle group (left of /right of footer).
  const [combinedPanelCollapsed, setCombinedPanelCollapsed] = useState(true);
  const [combinedTapeCollapsed, setCombinedTapeCollapsed] = useState(false);
  // [claude-code 2026-04-26] Three-panel toggle state per TP — VS Code-style
  // group of left / footer / right buttons in TopHeader. NavSidebar starts
  // visible (false). FooterToolbar starts visible (false).
  const [navSidebarCollapsed, setNavSidebarCollapsed] = useState(false);
  const [footerCollapsed, setFooterCollapsed] = useState(false);
  const [layoutOption, setLayoutOptionRaw] =
    useState<LayoutOption>(defaultLayout);
  const [prevLayoutOption, setPrevLayoutOption] = useState<LayoutOption | null>(
    null,
  );
  const userPickedLayout = useRef(false);

  // Sync when settings default changes (unless user already picked manually)
  useEffect(() => {
    if (!userPickedLayout.current) {
      setLayoutOptionRaw(defaultLayout);
    }
  }, [defaultLayout]);

  const setLayoutOption = useCallback((opt: LayoutOption) => {
    userPickedLayout.current = true;
    setLayoutOptionRaw(opt);
  }, []);
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
      setLayoutOptionRaw(defaultLayout);
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
    navSidebarCollapsed,
    setNavSidebarCollapsed,
    footerCollapsed,
    setFooterCollapsed,
  };
}
