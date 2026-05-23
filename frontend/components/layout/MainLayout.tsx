// [claude-code 2026-05-05] Strategium mirror: main content now has full 4-sided border + rounding (border-r + rounded-r-2xl) and Strategium uses bg-surface (lighter) so right-side rounded corners show the same floating-below effect as the left sidebar.
// [claude-code 2026-05-05] Shell resiliency + polish: overflow-safe root container and rounded Strategium housing aligned with sidebar visual language.
// [claude-code 2026-03-11] Track 4: MC overhaul — no Panels header, collapse in MC header, 50/50 flex, gear menu
// [claude-code 2026-03-11] T3d: removed auto-enable from platform dropdown — power controlled via dedicated button only
// [claude-code 2026-03-20] S3:T4c: Linked Strategium ↔ RiskFlow collapse — both expand/collapse together
// [claude-code 2026-03-22] Replaced "The Tape" in Castra with RiskFlowMini (same as non-iFrame Strategium)
// [claude-code 2026-03-31] S12-T2: Added Documents tab (TipTap editor)
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import type { IVScoreResponse } from "../../types/market-data";
import { TopHeader } from "./TopHeader";
import { NavSidebar } from "./NavSidebar";
import { MinimalTapeWidget } from "../feed/MinimalTapeWidget";
import { TradingBrowser } from "../TradingBrowser";
import { TimelineOverlay, TimelineToggleButton } from "./TimelineOverlay";
import { FloatingWidget } from "./FloatingWidget";
import { useBackend } from "../../lib/backend";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { EmotionalResonanceMonitor } from "../mission-control/EmotionalResonanceMonitor";
// [claude-code 2026-04-23] S30-T2: BlindspotsWidget retired from Strategium — promoted to Performance tab.
import { WeeklyPerformanceWidget } from "../mission-control/WeeklyPerformanceWidget";
import { AccountTrackerWidget } from "../mission-control/AccountTrackerWidget";
import { AlgoStatusWidget } from "../mission-control/AlgoStatusWidget";
import { DeskThemeWidget } from "../mission-control/DeskThemeWidget";
import { PanelNotificationWidget } from "./PanelNotificationWidget";
import { MinimalERMeter } from "../MinimalERMeter";
// [claude-code 2026-04-03] S14-T5: Scriptorium standalone tab removed — knowledge archive accessed via Apparatus dropdown
import { SectionBreadcrumb } from "./SectionBreadcrumb";
import RiskFlowMini from "../RiskFlowMini";
import { useRiskFlow } from "../../contexts/RiskFlowContext";
import { SearchModal } from "../search/SearchModal";
import { useSettings } from "../../contexts/SettingsContext";
import {
  PsychAssistDockable,
  type PsychAssistDockTarget,
} from "./PsychAssistDockable";
import { EconCountdownWidget } from "./EconCountdownWidget";
import { useEconWatchHealth } from "../../hooks/useEconWatchHealth";
// [claude-code 2026-04-20] S21: Voice layer — Performance chat button + app-wide agent popup
// [claude-code 2026-04-24] PerformanceChatButton retired — heading-toolbar chat
// button had no clear purpose; the orb is the single voice trigger now.
// import { PerformanceChatButton } from "../performance/PerformanceChatButton";
// [claude-code 2026-04-24] Floating COACH popup removed — agent voice now plays
// through the shared waveform on the rim; no draggable bordered widget.
// import { AgentResponsePopupHost } from "../voice/AgentResponsePopupHost";
import { AgentVoiceWaveform } from "../voice/AgentVoiceWaveform";
import { FooterToolbar } from "./FooterToolbar";
import { EmbeddedBrowserFrame } from "./EmbeddedBrowserFrame";
import { ScheduleProvider } from "../../contexts/ScheduleContext";
import { YouTubeMiniplayerProvider } from "../../contexts/YouTubeMiniplayerContext";
// [claude-code 2026-04-03] S14-T5: Removed DocumentsView, SharedMemoryPanel, ResearchBoard standalone imports — now in ConsiliumHub
import { FirstTimeTour } from "../onboarding/FirstTimeTour";
// [claude-code 2026-03-16] Hermes moved from standalone page into Settings tab
import { SessionCountdownWidget } from "../mission-control/SessionCountdownWidget";
import { RegimeMini } from "../mission-control/RegimeMini";
import { MiniProposalCard } from "../mission-control/MiniProposalCard";
import { SessionCalendarMini } from "../mission-control/SessionCalendarMini";
import { DNDProvider, useDND } from "../../contexts/DNDContext";
import { NotificationCenter } from "../NotificationCenter";
import { TabRenderer } from "./TabRenderer";
import { MissionControlContent } from "./MissionControlContent";
import { ChatPanel } from "./ChatPanel";
import { YouTubeMiniplayer } from "./YouTubeMiniplayer";
// [claude-code 2026-04-03] S14-T6: Removed PeerCarousel + PeerOnboarding — team status now in footer panel
// TeamOnboarding re-wired into TeamPanel behind auth gate (2026-04-11)
// Voice lives in the app-native ProxVoice surface.
import {
  DEFAULT_MISSION_WIDGET_ORDER,
  getMissionWidgetOrder,
  setMissionWidgetOrder,
  getMissionWidgetVisibility,
  setMissionWidgetVisibility,
  getStrategiumPaneMode,
  setStrategiumPaneMode,
  type MissionWidgetId,
  type StrategiumPaneMode,
} from "../../lib/layoutOrderStorage";
import { StrategiumPeekBar } from "./StrategiumPeekBar";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useLayoutState } from "../../hooks/useLayoutState";
import { useBrowserTransition } from "../../hooks/useBrowserTransition";

type NavTab =
  | "feed"
  | "analysis"
  | "riskflow"
  | "dashboard"
  | "econ"
  | "narrative"
  | "apparatus"
  | "performance"
  | "proposals"
  | "settings";
type LayoutOption = "tickers-only" | "combined";

// [claude-code 2026-04-19] Last-visited tab persistence — restores the user's
// prior surface on sign-in / app restart so we don't dump them back at the
// default dashboard. Invalid / legacy values fall back to "dashboard".
const LAST_ROUTE_KEY = "fintheon:last-route:v1";
const VALID_TABS: ReadonlySet<NavTab> = new Set<NavTab>([
  "feed",
  "analysis",
  "riskflow",
  "dashboard",
  "econ",
  "narrative",
  "apparatus",
  "performance",
  "proposals",
  "settings",
]);

function readLastRoute(): NavTab {
  if (typeof window === "undefined") return "dashboard";
  try {
    const raw = window.localStorage.getItem(LAST_ROUTE_KEY);
    if (raw && VALID_TABS.has(raw as NavTab)) return raw as NavTab;
  } catch {
    // ignore
  }
  return "dashboard";
}

function writeLastRoute(tab: NavTab): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_ROUTE_KEY, tab);
  } catch {
    // ignore
  }
}

// TEAM_ONBOARDED_KEY removed

function normalizeOrder<T extends string>(
  order: T[],
  defaults: readonly T[],
): T[] {
  const deduped = order.filter(
    (id, idx) => defaults.includes(id) && order.indexOf(id) === idx,
  );
  const missing = defaults.filter((id) => !deduped.includes(id));
  return [...deduped, ...missing];
}

// Wrapper to provide DNDProvider above MainLayout internals
export function MainLayout() {
  return (
    <DNDProvider>
      <MainLayoutInner />
    </DNDProvider>
  );
}

// Responsive tier breakpoints for progressive shell compaction
const COMPACT_MODERATE_BP = 1280;
const COMPACT_SEVERE_BP = 1060;

// Main layout component - no authentication needed
function MainLayoutInner() {
  const { iframeUrls, defaultLayout, defaultPlatform, developerSettings } =
    useSettings();
  const { theme } = useTheme();
  const isStone = theme.name === "solvys-stone";
  const { setAutoDnd, flushQueue, toggleManualDnd } = useDND();
  const [activeTab, setActiveTab] = useState<NavTab>(() => readLastRoute());

  // [claude-code 2026-05-05] Tiered responsive compaction — MainLayout owns
  // the viewport-width state and passes compactLevel (0/1/2) to children so
  // each surface can progressively shed non-essential chrome.
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1600 : window.innerWidth,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const compactLevel: 0 | 1 | 2 =
    viewportWidth < COMPACT_SEVERE_BP
      ? 2
      : viewportWidth < COMPACT_MODERATE_BP
        ? 1
        : 0;

  const {
    topStepXEnabled,
    browserTransitioning,
    browserVisible,
    selectedPlatform,
    setSelectedPlatform,
    secondaryPlatform,
    setSecondaryPlatform,
    splitBrowserView,
    setSplitBrowserView,
    handleBrowserToggle,
    handleBrowserEnable,
  } = useBrowserTransition({ defaultPlatform });

  const {
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
  } = useLayoutState({
    topStepXEnabled,
    defaultLayout,
    setAutoDnd,
    flushQueue,
  });

  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [showRefinement, setShowRefinement] = useState(false);
  const [timelineOverlayOpen, setTimelineOverlayOpen] = useState(false);
  const refinementEnabled =
    typeof window !== "undefined" &&
    localStorage.getItem("fintheon-refinement-enabled") === "true";
  const [tabTransitioning, setTabTransitioning] = useState(false);
  const [prevTab, setPrevTab] = useState<NavTab | null>(null);
  const [ivData, setIvData] = useState<IVScoreResponse | null>(null);
  const [ivLoading, setIvLoading] = useState(true);
  const [showMissionControlNotification, setShowMissionControlNotification] =
    useState(false);
  const [showTapeNotification, setShowTapeNotification] = useState(false);
  const [combinedPanelErScore, setCombinedPanelErScore] = useState(0);
  const [combinedPanelPnl, setCombinedPanelPnl] = useState(0);
  const [combinedPanelAlgoEnabled, setCombinedPanelAlgoEnabled] =
    useState(false);
  const [showChat, setShowChat] = useState(false);
  const handleChatAlert = useCallback(
    (alert: {
      headline: string;
      summary?: string | null;
      source?: string;
      ivScore?: number | null;
      publishedAt?: string;
    }) => {
      setShowChat(true);
      const parts: string[] = [];
      parts.push(`[RiskFlow Context]`);
      parts.push(`Headline: ${alert.headline}`);
      if (alert.source) parts.push(`Source: ${alert.source}`);
      if (alert.ivScore != null)
        parts.push(`IV Score: ${alert.ivScore.toFixed(1)}`);
      if (alert.publishedAt) {
        const ago = Math.round(
          (Date.now() - new Date(alert.publishedAt).getTime()) / 60000,
        );
        parts.push(`Time: ${ago}m ago`);
      }
      if (alert.summary && alert.summary !== alert.headline) {
        parts.push(`Summary: ${alert.summary}`);
      }
      window.dispatchEvent(
        new CustomEvent("fintheon:send-chat-text", {
          detail: { text: parts.join("\n") },
        }),
      );
    },
    [],
  );
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showYouTubeMiniplayer, setShowYouTubeMiniplayer] = useState(() => {
    try {
      return localStorage.getItem("fintheon:yt-miniplayer-open") === "true";
    } catch {
      return false;
    }
  });
  const [missionWidgetOrder, setMissionWidgetOrderState] = useState<
    MissionWidgetId[]
  >(() =>
    normalizeOrder(getMissionWidgetOrder(), DEFAULT_MISSION_WIDGET_ORDER),
  );
  const [missionWidgetVisibility, setMissionWidgetVisibilityState] = useState<
    Record<MissionWidgetId, boolean>
  >(getMissionWidgetVisibility);
  // [claude-code 2026-04-25] Strategium fullscreen modes (feedOnly / widgetsOnly) retired
  // along with the maximize-RiskFlow overlay button. Any persisted mode is normalized to
  // "balanced" on mount so users coming in with stale state aren't stranded in a mode
  // there's no longer a UI control to leave.
  const [strategiumPaneMode, setStrategiumPaneModeState] =
    useState<StrategiumPaneMode>(() => {
      const m = getStrategiumPaneMode();
      return m === "balanced" ? m : "balanced";
    });
  const updateStrategiumPaneMode = useCallback((mode: StrategiumPaneMode) => {
    setStrategiumPaneModeState(mode);
    setStrategiumPaneMode(mode);
  }, []);
  useEffect(() => {
    if (strategiumPaneMode !== "balanced") {
      updateStrategiumPaneMode("balanced");
    }
    // run once on mount to clear stale persisted modes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // [claude-code 2026-04-26] Header PanelToggleGroup right-button wiring.
  // Toggles the Strategium right-panel collapse + broadcasts state back so the
  // header icon's filled-right indicator stays in sync.
  useEffect(() => {
    const onToggle = () => setMissionControlCollapsed((prev: boolean) => !prev);
    window.addEventListener("fintheon:toggle-strategium", onToggle);
    return () =>
      window.removeEventListener("fintheon:toggle-strategium", onToggle);
  }, [setMissionControlCollapsed]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("fintheon:strategium-state", {
        detail: { open: !missionControlCollapsed },
      }),
    );
  }, [missionControlCollapsed]);
  const [psychAssistTarget, setPsychAssistTarget] =
    useState<PsychAssistDockTarget>(() => {
      try {
        return (
          (localStorage.getItem(
            "fintheon:psychassist-target:v1",
          ) as PsychAssistDockTarget) || "floating"
        );
      } catch {
        return "floating";
      }
    });
  useEffect(() => {
    try {
      localStorage.setItem("fintheon:psychassist-target:v1", psychAssistTarget);
    } catch {
      // ignore
    }
  }, [psychAssistTarget]);

  const { events: econWatchEvents } = useEconWatchHealth();
  const [econCountdownDismissed, setEconCountdownDismissed] = useState(false);

  // Show econ countdown when there's an upcoming event within 60min window
  // and the user hasn't dismissed it. PsychAssist shows otherwise.
  const showEconCountdown = (() => {
    if (econCountdownDismissed) return false;
    const now = Date.now();
    for (const ev of econWatchEvents) {
      if (ev.status !== "upcoming") continue;
      const target = new Date(ev.scheduledAt).getTime();
      if (target > now && target - now < 60 * 60 * 1000) return true;
    }
    return false;
  })();

  // Reset dismissal when the event window changes
  useEffect(() => {
    if (!showEconCountdown) setEconCountdownDismissed(false);
  }, [showEconCountdown]);

  useEffect(() => {
    setMissionWidgetOrderState((prev) =>
      normalizeOrder(prev, DEFAULT_MISSION_WIDGET_ORDER),
    );
  }, []);

  // Tab history for breadcrumb back/forward navigation
  const [tabHistory, setTabHistory] = useState<NavTab[]>(() => [activeTab]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Persist every tab change so the next boot lands on the same surface.
  useEffect(() => {
    writeLastRoute(activeTab);
  }, [activeTab]);

  const navigateTab = (tab: NavTab) => {
    // Trim forward history when navigating to a new tab
    const trimmed = tabHistory.slice(0, historyIndex + 1);
    trimmed.push(tab);
    setTabHistory(trimmed);
    setHistoryIndex(trimmed.length - 1);
    setActiveTab(tab);
  };

  const goBack = () => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setActiveTab(tabHistory[newIdx]);
    }
  };

  const goForward = () => {
    if (historyIndex < tabHistory.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      setActiveTab(tabHistory[newIdx]);
    }
  };

  const backend = useBackend();
  const { isAuthenticated } = useAuth();
  const { alerts: riskFlowAlerts, removeAlert, isSeen } = useRiskFlow();
  useKeyboardShortcuts({
    navigateTab: navigateTab as (tab: string) => void,
    setShowSearchModal,
    setShowYouTubeMiniplayer,
    setNotificationCenterOpen,
    toggleManualDnd,
  });

  // Fetch blended IV score from backend for floating widget
  useEffect(() => {
    const fetchIVScore = async () => {
      try {
        const data = await backend.marketData.getIVScore();
        setIvData(data);
      } catch (error) {
        console.warn("[IV] Failed to fetch IV score:", error);
      } finally {
        setIvLoading(false);
      }
    };

    fetchIVScore();
    const interval = setInterval(fetchIVScore, 300000);
    return () => clearInterval(interval);
  }, [backend]);

  // Fetch account data for combined panel collapsed state (waits for auth)
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchAccount = async () => {
      try {
        const account = await backend.account.get();
        setCombinedPanelPnl(account.dailyPnl);
        setCombinedPanelAlgoEnabled(account.autoTrade || false);
      } catch (err) {
        console.warn("Failed to fetch account:", err);
      }
    };
    fetchAccount();
    const interval = setInterval(fetchAccount, 5000);
    return () => clearInterval(interval);
  }, [backend, isAuthenticated]);

  // Listen for ER score updates for combined panel
  useEffect(() => {
    const handleERUpdate = (event: CustomEvent<number>) => {
      setCombinedPanelErScore(event.detail);
    };
    window.addEventListener("erScoreUpdate", handleERUpdate as EventListener);
    return () => {
      window.removeEventListener(
        "erScoreUpdate",
        handleERUpdate as EventListener,
      );
    };
  }, []);

  // Normalize ER score from -10 to 10 range to 0-1 range for display
  const normalizedCombinedPanelResonance = Math.max(
    0,
    Math.min(1, (combinedPanelErScore + 10) / 20),
  );

  const handleTabChange = (tab: NavTab) => {
    if (tab === activeTab || tabTransitioning) return;
    setTabTransitioning(true);
    setPrevTab(activeTab);
    setTimeout(() => {
      navigateTab(tab);
      setTimeout(() => {
        setTabTransitioning(false);
        setPrevTab(null);
      }, 50);
    }, 300);
  };

  const handleLogout = async () => {
    try {
      const { signOut } = await import("../../lib/supabase");
      await signOut();
      // Force reload to reset all state and show login screen
      window.location.reload();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Determine layout based on TopStepX state and layout option
  const showMissionControl =
    topStepXEnabled && missionControlPosition !== "floating";
  const showTape = topStepXEnabled && tapePosition !== "floating";
  const showFloatingWidget = topStepXEnabled && layoutOption === "tickers-only";
  const showCombinedPanel = topStepXEnabled && layoutOption === "combined";
  const zenModeActive = topStepXEnabled && layoutOption === "tickers-only";

  useEffect(() => {
    document.body.dataset.fintheonZenMode = zenModeActive ? "true" : "false";
    document.body.classList.toggle("fintheon-zen-mode", zenModeActive);
    window.dispatchEvent(
      new CustomEvent("fintheon:zen-mode-change", {
        detail: { active: zenModeActive },
      }),
    );

    return () => {
      document.body.dataset.fintheonZenMode = "false";
      document.body.classList.remove("fintheon-zen-mode");
      window.dispatchEvent(
        new CustomEvent("fintheon:zen-mode-change", {
          detail: { active: false },
        }),
      );
    };
  }, [zenModeActive]);

  // Determine panel order based on position and layout option
  const leftPanels: React.ReactNode[] = [];
  const rightPanels: React.ReactNode[] = [];

  const handleMissionWidgetReorder = useCallback((order: MissionWidgetId[]) => {
    const normalized = normalizeOrder(order, DEFAULT_MISSION_WIDGET_ORDER);
    setMissionWidgetOrderState(normalized);
    setMissionWidgetOrder(normalized);
  }, []);

  const handleMissionWidgetToggleVisibility = useCallback(
    (id: MissionWidgetId) => {
      setMissionWidgetVisibilityState((prev) => {
        const next = { ...prev, [id]: !(prev[id] !== false) };
        setMissionWidgetVisibility(next);
        return next;
      });
    },
    [],
  );

  // [claude-code 2026-04-25] Reset Strategium widget order + visibility to defaults.
  // Wired to the t-dropdown reset button that fades in next to Pencil when edit mode is on.
  const handleMissionWidgetResetLayout = useCallback(() => {
    setMissionWidgetOrderState(DEFAULT_MISSION_WIDGET_ORDER);
    setMissionWidgetOrder(DEFAULT_MISSION_WIDGET_ORDER);
    const allOn: Record<MissionWidgetId, boolean> = {
      er: true,
      autopilot: true,
      regime: true,
      account: true,
      weekly: true,
      calendar: true,
      deskTheme: true,
    };
    setMissionWidgetVisibilityState(allOn);
    setMissionWidgetVisibility(allOn);
  }, []);

  const missionWidgetRegistry = useMemo(
    () => ({
      er: {
        id: "er" as const,
        label: "Emotional Resonance",
        node: (
          <EmotionalResonanceMonitor
            onERScoreChange={setCombinedPanelErScore}
          />
        ),
      },
      autopilot: {
        id: "autopilot" as const,
        label: "Autopilot",
        node: <AlgoStatusWidget />,
      },
      regime: {
        id: "regime" as const,
        label: "Regime Tracker",
        node: (
          <div className="space-y-2">
            <RegimeMini />
            <MiniProposalCard onExpand={() => handleTabChange("proposals")} />
          </div>
        ),
      },
      account: {
        id: "account" as const,
        label: "Account Tracker",
        node: <AccountTrackerWidget />,
      },
      weekly: {
        id: "weekly" as const,
        label: "Weekly Performance",
        node: <WeeklyPerformanceWidget />,
      },
      calendar: {
        id: "calendar" as const,
        label: "Session Calendar",
        node: <SessionCalendarMini />,
      },
      // [claude-code 2026-04-28] T3: Renamed Desk Theme -> Desk Plan in visible UI.
      // [claude-code 2026-04-27] S46.4/G: Desk Plan widget — pulls deskTheme
      // from /api/day-plan/today + tap-to-expand into the matching brief.
      deskTheme: {
        id: "deskTheme" as const,
        label: "Desk Plan",
        node: <DeskThemeWidget />,
      },
    }),
    [],
  );

  const orderedMissionWidgets = useMemo(() => {
    const normalized = normalizeOrder(
      missionWidgetOrder,
      DEFAULT_MISSION_WIDGET_ORDER,
    );
    return normalized
      .filter((id) => missionWidgetVisibility[id] !== false)
      .map((id) => missionWidgetRegistry[id]);
  }, [missionWidgetOrder, missionWidgetRegistry, missionWidgetVisibility]);

  // Full list (including hidden) for the arrange menu
  const allMissionWidgets = useMemo(() => {
    const normalized = normalizeOrder(
      missionWidgetOrder,
      DEFAULT_MISSION_WIDGET_ORDER,
    );
    return normalized.map((id) => ({
      id,
      label: missionWidgetRegistry[id].label,
    }));
  }, [missionWidgetOrder, missionWidgetRegistry]);

  const renderMissionControl = useCallback(
    (collapseFn?: () => void) => (
      <MissionControlContent
        orderedMissionWidgets={orderedMissionWidgets}
        allMissionWidgets={allMissionWidgets}
        missionWidgetVisibility={missionWidgetVisibility}
        onReorder={handleMissionWidgetReorder}
        onToggleVisibility={handleMissionWidgetToggleVisibility}
        onResetLayout={handleMissionWidgetResetLayout}
        collapseFn={collapseFn}
        editMode={layoutEditMode}
        onToggleEditMode={() => setLayoutEditMode(!layoutEditMode)}
      />
    ),
    [
      orderedMissionWidgets,
      allMissionWidgets,
      missionWidgetVisibility,
      handleMissionWidgetReorder,
      handleMissionWidgetToggleVisibility,
      handleMissionWidgetResetLayout,
      layoutEditMode,
      setLayoutEditMode,
    ],
  );

  // When TopStepX is enabled, render panels based on layout option
  if (topStepXEnabled) {
    if (layoutOption === "combined") {
      // Combined panel: Mission Control + The Tape in one scroll (split, no overlap)
      rightPanels.push(
        <div
          key="combined"
          className={`fintheon-side-surface bg-[var(--fintheon-bg)] border-y border-r border-[var(--fintheon-accent)]/20 rounded-tr-2xl rounded-br-2xl transition-all duration-200 ${combinedPanelCollapsed ? "w-16" : "w-[min(380px,42vw)]"}`}
        >
          <div className="h-full flex flex-col">
            {combinedPanelCollapsed && (
              <div className="h-12 flex-shrink-0 flex items-center justify-center border-b border-[var(--fintheon-accent)]/20">
                <button
                  onClick={() => setCombinedPanelCollapsed(false)}
                  className="p-1.5 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-[var(--fintheon-accent)]" />
                </button>
              </div>
            )}
            {!combinedPanelCollapsed && (
              <div className="flex-1 min-h-0 flex flex-col">
                {/* Mission Control: 50% height, no overflow into tape */}
                <section
                  className={`${combinedTapeCollapsed ? "flex-1" : "h-1/2"} min-h-0 overflow-y-auto border-b border-[var(--fintheon-accent)]/20`}
                >
                  <div className="p-3 h-full">
                    {renderMissionControl(() =>
                      setCombinedPanelCollapsed(true),
                    )}
                  </div>
                </section>
                {/* RiskFlow: 50% when expanded, 168px collapsed preview at bottom */}
                <section
                  className={`${combinedTapeCollapsed ? "h-[168px] shrink-0" : "h-1/2"} min-h-0 flex flex-col`}
                >
                  <RiskFlowMini
                    collapsed={combinedTapeCollapsed}
                    onToggleCollapsed={() =>
                      setCombinedTapeCollapsed(!combinedTapeCollapsed)
                    }
                    onNavigateToFeed={() => navigateTab("riskflow")}
                    onChatAlert={handleChatAlert}
                  />
                </section>
              </div>
            )}
            {combinedPanelCollapsed && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-2 bg-[var(--fintheon-surface)]">
                <div className="w-full max-w-[120px]">
                  <MinimalERMeter
                    resonance={normalizedCombinedPanelResonance}
                    pnl={combinedPanelPnl}
                    algoEnabled={combinedPanelAlgoEnabled}
                  />
                </div>
                <div className="w-full max-w-[120px]">
                  <MinimalTapeWidget />
                </div>
              </div>
            )}
          </div>
        </div>,
      );
    }
    // For 'tickers-only', no panels are shown (only floating widget)
  } else {
    // When TopStepX is disabled: right stack = Mission Control + collapsible RiskFlow
    const hideRightPanel =
      showRefinement ||
      activeTab === "analysis" ||
      activeTab === "econ" ||
      activeTab === "narrative" ||
      activeTab === "apparatus" ||
      activeTab === "performance" ||
      activeTab === "proposals" ||
      activeTab === "settings";
    if (!hideRightPanel) {
      rightPanels.push(
        // [claude-code 2026-04-29] S49: Strategium now uses a slide-out drawer
        // transition (like ChatPanel). Always rendered in DOM when not hidden by
        // active-tab guard; width + opacity transition handles open/close.
        <div
          key="right-stack"
          className={`h-full flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
            missionControlCollapsed
              ? "w-0 opacity-0 pointer-events-none invisible"
              : "w-[min(380px,42vw)] opacity-100"
          }`}
        >
          <div className="fintheon-side-surface flex-1 min-h-0 flex flex-col bg-[var(--fintheon-surface)] border-r border-[var(--fintheon-accent)]/20 rounded-tr-2xl rounded-br-2xl">
            {/* Widgets pane — shown in balanced + widgetsOnly.
                  [claude-code 2026-04-24] min-h-0 is CRITICAL in widgetsOnly:
                  without it, flex-1 + inner content force the pane taller than
                  the viewport and push the RiskFlow peek-footer off-screen. */}
            {strategiumPaneMode !== "feedOnly" && (
              <div
                className={`${
                  strategiumPaneMode === "widgetsOnly"
                    ? "flex-1 min-h-0"
                    : riskFlowCollapsed
                      ? "flex-1 min-h-0"
                      : "h-1/2 min-h-0"
                } flex flex-col transition-all duration-300 bg-[var(--fintheon-surface)] relative`}
              >
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="p-3 h-full">
                    {renderMissionControl(() =>
                      setMissionControlCollapsed(true),
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* RiskFlow pane — shown in balanced + feedOnly (and only when not fully-collapsed-in-feedOnly) */}
            {strategiumPaneMode !== "widgetsOnly" &&
              !(strategiumPaneMode === "feedOnly" && riskFlowCollapsed) && (
                <div
                  className={`${
                    strategiumPaneMode === "feedOnly"
                      ? "flex-1"
                      : riskFlowCollapsed
                        ? "h-[168px] shrink-0"
                        : "h-1/2"
                  } flex flex-col transition-all duration-300 relative`}
                >
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <RiskFlowMini
                      collapsed={riskFlowCollapsed}
                      onToggleCollapsed={() => {
                        // [S37] Balanced-mode collapse now reaches the 168px mini card instead
                        // of jumping to widgetsOnly (which fully hid the feed and left the user
                        // unable to restore). In each mode we toggle the riskFlowCollapsed flag
                        // directly — balanced + collapsed = 168px mini, feedOnly + collapsed
                        // = peek-footer, widgetsOnly still relies on its own peek-footer.
                        if (strategiumPaneMode === "feedOnly") {
                          setRiskFlowCollapsed(true);
                        } else {
                          setRiskFlowCollapsed((v) => !v);
                        }
                      }}
                      onNavigateToFeed={() => navigateTab("riskflow")}
                      onChatAlert={handleChatAlert}
                    />
                  </div>
                </div>
              )}

            {/* RiskFlow peek-footer — visible whenever the feed is fully hidden so users can always bring it back */}
            {(strategiumPaneMode === "widgetsOnly" ||
              (strategiumPaneMode === "feedOnly" && riskFlowCollapsed)) && (
              <StrategiumPeekBar
                variant="footer"
                label="RiskFlow"
                unreadCount={
                  riskFlowAlerts.filter((a: { id: string }) => !isSeen(a.id))
                    .length
                }
                onRestore={() => {
                  if (strategiumPaneMode === "widgetsOnly") {
                    updateStrategiumPaneMode("balanced");
                  } else {
                    setRiskFlowCollapsed(false);
                  }
                }}
              />
            )}
          </div>
        </div>,
      );
    }
  }

  return (
    <ScheduleProvider>
      <YouTubeMiniplayerProvider>
        <div
          className={`fintheon-app-shell h-screen w-full overflow-hidden flex flex-col bg-[var(--fintheon-bg)] text-white ${topStepXEnabled ? "topstepx-active" : ""}`}
        >
          {/* [claude-code 2026-04-24] Standalone waveform overlay — no border, no
            background. Doubles as user-mic indicator (when listening) and agent
            voice (when speaking). The previous draggable COACH popup is gone. */}
          <AgentVoiceWaveform />
          <TopHeader
            topStepXEnabled={topStepXEnabled}
            onTopStepXToggle={handleBrowserEnable} // [claude-code 2026-03-16] Restore: clicking platform in dropdown enables iframe
            onTopStepXDisable={handleBrowserToggle}
            selectedPlatform={selectedPlatform}
            onPlatformSelect={setSelectedPlatform}
            layoutOption={layoutOption}
            onLayoutOptionChange={setLayoutOption}
            chatOpen={showChat}
            onChatToggle={() =>
              setShowChat((prev) => {
                // Opening chat in Castra → auto-switch to Zen so panels don't fight for space
                if (!prev && topStepXEnabled && layoutOption === "combined") {
                  setLayoutOption("tickers-only");
                }
                return !prev;
              })
            }
            activeTab={activeTab}
            tabHistory={tabHistory}
            historyIndex={historyIndex}
            onBack={goBack}
            onForward={goForward}
            hideBranding={topStepXEnabled && sidebarOverlayVisible}
            toolbarEditMode={layoutEditMode}
            psychAssistHeadingWidget={
              topStepXEnabled &&
              layoutOption === "tickers-only" &&
              psychAssistTarget === "header" &&
              !showEconCountdown ? (
                <PsychAssistDockable
                  target="header"
                  onDockToHeader={() => setPsychAssistTarget("header")}
                  onUndockToFloating={() => setPsychAssistTarget("floating")}
                />
              ) : undefined
            }
            econCountdownWidget={
              topStepXEnabled &&
              layoutOption === "tickers-only" &&
              showEconCountdown ? (
                <EconCountdownWidget
                  visible={showEconCountdown}
                  onDismiss={() => setEconCountdownDismissed(true)}
                />
              ) : undefined
            }
            compactLevel={compactLevel}
            /* [claude-code 2026-04-24] performanceChatWidget removed — orb is
             the only voice trigger now. */
          />

          {/* S14-T6: Peers panel removed — team status is now in footer Team tab */}

          <div className="flex-1 flex overflow-hidden relative bg-[var(--fintheon-surface)]">
            <div
              className={
                topStepXEnabled
                  ? "hidden"
                  : "relative shrink-0 transition-[width] duration-300 ease-in-out"
              }
            >
              <NavSidebar
                activeTab={activeTab}
                onTabChange={(tab) => {
                  setShowRefinement(false);
                  handleTabChange(tab);
                }}
                onLogout={handleLogout}
                topStepXEnabled={topStepXEnabled}
                onOverlayVisibilityChange={setSidebarOverlayVisible}
                editMode={layoutEditMode}
                onEditModeChange={setLayoutEditMode}
                onNotificationCenterToggle={() =>
                  setNotificationCenterOpen((v) => !v)
                }
                onRefinementClick={() => setShowRefinement((v) => !v)}
                refinementEnabled={refinementEnabled}
                refinementActive={showRefinement}
              />
              <NotificationCenter
                open={notificationCenterOpen}
                onClose={() => setNotificationCenterOpen(false)}
              />
            </div>

            {/* Left Panels */}
            {leftPanels.length > 0 && <div className="flex">{leftPanels}</div>}

            {/* Center Content - TopStepX or Main Content with crossfade.
                Full 4-sided gold hairline border + rounded corners so the main
                content floats above both the left sidebar and the right Strategium
                (which use bg-surface, lighter than the main content's bg-bg). */}
            <div className="fintheon-main-surface z-10 flex-1 overflow-hidden relative min-w-0 flex flex-col border-t border-b border-l border-r border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] rounded-tl-2xl rounded-bl-2xl rounded-tr-2xl rounded-br-2xl">
              {/* Timeline overlay — slides over browser, does not affect iframe sizing */}
              <TimelineOverlay
                open={timelineOverlayOpen}
                onClose={() => setTimelineOverlayOpen(false)}
              />
              {topStepXEnabled && !timelineOverlayOpen && (
                <TimelineToggleButton
                  onClick={() => setTimelineOverlayOpen(true)}
                />
              )}

              {/* Browser layer */}
              {topStepXEnabled && (
                <div
                  className={`absolute inset-0 z-10 ${isStone ? "bg-black" : ""} ${browserVisible ? "animate-browser-in" : "animate-browser-out"}`}
                >
                  <TradingBrowser
                    primaryPlatform={selectedPlatform}
                    onPrimaryPlatformChange={setSelectedPlatform}
                    secondaryPlatform={secondaryPlatform}
                    onSecondaryPlatformChange={setSecondaryPlatform}
                    splitViewEnabled={splitBrowserView}
                    onSplitViewEnabledChange={setSplitBrowserView}
                    allowSplitView={topStepXEnabled}
                  />
                </div>
              )}

              {/* Main content layer */}
              <div
                className={`h-full relative flex-1 flex flex-col ${topStepXEnabled ? "pointer-events-none" : ""}`}
                style={{
                  opacity: topStepXEnabled ? 0 : 1,
                  transition: "opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <TabRenderer
                  activeTab={activeTab}
                  tabTransitioning={tabTransitioning}
                  prevTab={prevTab}
                  showRefinement={showRefinement}
                  navigateTab={navigateTab}
                  onChatAlert={handleChatAlert}
                />
              </div>
            </div>

            {/* Right Panels */}
            {rightPanels.length > 0 && (
              <div className="flex">{rightPanels}</div>
            )}

            {/* Floating Widget */}
            {showFloatingWidget && (
              <FloatingWidget
                ivData={ivData}
                ivLoading={ivLoading}
                layoutOption={layoutOption}
                onClose={() => {}}
              />
            )}

            {/* Zen Layout: dockable PsychAssist widget (float ↔ header) */}
            {topStepXEnabled &&
              layoutOption === "tickers-only" &&
              psychAssistTarget === "floating" && (
                <PsychAssistDockable
                  target="floating"
                  onDockToHeader={() => setPsychAssistTarget("header")}
                  onUndockToFloating={() => setPsychAssistTarget("floating")}
                />
              )}

            {/* Panel Notification Widgets */}
            {showMissionControlNotification && (
              <PanelNotificationWidget
                panelName="Mission Control"
                position={zenModeActive ? "bottom-right" : "top-right"}
                onRestore={() => {
                  setMissionControlPosition("right");
                  setShowMissionControlNotification(false);
                }}
                onDismiss={() => setShowMissionControlNotification(false)}
              />
            )}
            {showTapeNotification && (
              <PanelNotificationWidget
                panelName="RiskFlow"
                position={zenModeActive ? "bottom-right" : "top-right"}
                onRestore={() => {
                  setTapePosition("right");
                  setShowTapeNotification(false);
                }}
                onDismiss={() => setShowTapeNotification(false)}
              />
            )}

            {/* YouTube floating miniplayer — persists independent of TradingBrowser */}
            {showYouTubeMiniplayer && (
              <YouTubeMiniplayer
                onClose={() => {
                  setShowYouTubeMiniplayer(false);
                  try {
                    localStorage.setItem(
                      "fintheon:yt-miniplayer-open",
                      "false",
                    );
                  } catch {
                    /* ignore */
                  }
                }}
              />
            )}

            {/* Global chat panel — slide in/out from right */}
            <ChatPanel
              showChat={showChat}
              onClose={() => setShowChat(false)}
              navigateTab={(tab) => navigateTab(tab as NavTab)}
            />
          </div>

          <SessionCountdownWidget />

          <FooterToolbar
            compactLevel={compactLevel}
            topStepXEnabled={topStepXEnabled}
            primaryPlatform={selectedPlatform}
            onPrimaryPlatformChange={setSelectedPlatform}
            secondaryPlatform={secondaryPlatform}
            onSecondaryPlatformChange={setSecondaryPlatform}
            splitViewEnabled={splitBrowserView}
            onSplitViewToggle={() => setSplitBrowserView((v) => !v)}
            allowSplitView={topStepXEnabled}
            onPowerOff={handleBrowserToggle}
          />

          {/* Preload iframes — hidden, loads TopStepX + Research in background for instant tab switch */}
          {!topStepXEnabled && (
            <div
              style={{
                position: "fixed",
                left: "-9999px",
                width: "1px",
                height: "1px",
                overflow: "hidden",
              }}
            >
              <EmbeddedBrowserFrame
                title="TopStepX (preload)"
                src="https://www.topstepx.com"
              />
              <EmbeddedBrowserFrame
                title="Research (preload)"
                src={iframeUrls.research || ""}
              />
            </div>
          )}

          {/* Global overlays */}
          <SearchModal
            open={showSearchModal}
            onClose={() => setShowSearchModal(false)}
            onNavigateTab={(tab) => navigateTab(tab as NavTab)}
          />

          {/* First-time user tour + interview + setup wizard */}
          <FirstTimeTour onNavigate={(tab) => navigateTab(tab as NavTab)} />
        </div>
      </YouTubeMiniplayerProvider>
    </ScheduleProvider>
  );
}
