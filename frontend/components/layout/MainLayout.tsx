// [claude-code 2026-03-11] Track 4: MC overhaul — no Panels header, collapse in MC header, 50/50 flex, gear menu
// [claude-code 2026-03-11] T3d: removed auto-enable from platform dropdown — power controlled via dedicated button only
// [claude-code 2026-03-20] S3:T4c: Linked Strategium ↔ RiskFlow collapse — both expand/collapse together
// [claude-code 2026-03-22] Replaced "The Tape" in Castra with RiskFlowMini (same as non-iFrame Strategium)
// [claude-code 2026-03-31] S12-T2: Added Documents tab (TipTap editor)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { IVScoreResponse } from '../../types/market-data';
import { TopHeader } from './TopHeader';
import { NavSidebar } from './NavSidebar';
import { MinimalTapeWidget } from '../feed/MinimalTapeWidget';
import { TradingBrowser, type TradingPlatform } from '../TradingBrowser';
import { TimelineOverlay, TimelineToggleButton } from './TimelineOverlay';
import { FloatingWidget } from './FloatingWidget';
import { PanelPosition } from './DraggablePanel';
import { useBackend } from '../../lib/backend';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { EmotionalResonanceMonitor } from '../mission-control/EmotionalResonanceMonitor';
import { BlindspotsWidget } from '../mission-control/BlindspotsWidget';
import { AccountTrackerWidget } from '../mission-control/AccountTrackerWidget';
import { AlgoStatusWidget } from '../mission-control/AlgoStatusWidget';
import { PanelNotificationWidget } from './PanelNotificationWidget';
import { MinimalERMeter } from '../MinimalERMeter';
// [claude-code 2026-04-03] S14-T5: Scriptorium standalone tab removed — knowledge archive accessed via Apparatus dropdown
import { SectionBreadcrumb } from './SectionBreadcrumb';
import RiskFlowMini from '../RiskFlowMini';
import { useRiskFlow } from '../../contexts/RiskFlowContext';
import { SearchModal } from '../search/SearchModal';
import { useSettings } from '../../contexts/SettingsContext';
import { PsychAssistDockable, type PsychAssistDockTarget } from './PsychAssistDockable';
import { FooterToolbar } from './FooterToolbar';
import { EmbeddedBrowserFrame } from './EmbeddedBrowserFrame';
import { ScheduleProvider } from '../../contexts/ScheduleContext';
// [claude-code 2026-04-03] S14-T5: Removed DocumentsView, SharedMemoryPanel, ResearchBoard standalone imports — now in ConsiliumHub
import { FirstTimeTour } from '../onboarding/FirstTimeTour';
// [claude-code 2026-03-16] Hermes moved from standalone page into Settings tab
import { SessionCountdownWidget } from '../mission-control/SessionCountdownWidget';
import { RegimeMini } from '../mission-control/RegimeMini';
import { MiniProposalCard } from '../mission-control/MiniProposalCard';
import { SessionCalendarMini } from '../mission-control/SessionCalendarMini';
import { DNDProvider, useDND } from '../../contexts/DNDContext';
import { NotificationCenter } from '../NotificationCenter';
import { TabRenderer } from './TabRenderer';
import { MissionControlContent } from './MissionControlContent';
import { ChatPanel } from './ChatPanel';
import { YouTubeMiniplayer } from './YouTubeMiniplayer';
// [claude-code 2026-04-03] S14-T6: Removed PeerCarousel + PeerOnboarding — team status now in footer panel
// TeamOnboarding removed — exposes Supabase login to end users, security risk
import { EPOCH_VERSION } from '../../lib/epoch-version';
import { VoiceWidget, VoiceRoomHeaderButton, type VoiceWidgetDockTarget } from '../peers/VoiceWidget';
import {
  DEFAULT_MISSION_WIDGET_ORDER,
  getMissionWidgetOrder,
  setMissionWidgetOrder,
  getMissionWidgetVisibility,
  setMissionWidgetVisibility,
  type MissionWidgetId,
} from '../../lib/layoutOrderStorage';

type NavTab = 'feed' | 'analysis' | 'riskflow' | 'dashboard' | 'econ' | 'narrative' | 'apparatus' | 'performance' | 'proposals' | 'settings';
type LayoutOption = 'tickers-only' | 'combined';

// TEAM_ONBOARDED_KEY removed

function normalizeOrder<T extends string>(order: T[], defaults: readonly T[]): T[] {
  const deduped = order.filter((id, idx) => defaults.includes(id) && order.indexOf(id) === idx);
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

// Main layout component - no authentication needed
function MainLayoutInner() {
  const { iframeUrls, defaultLayout, defaultPlatform, developerSettings, voiceEnabled } = useSettings();
  const { theme } = useTheme();
  const isStone = theme.name === 'solvys-stone';
  const { setAutoDnd, flushQueue, toggleManualDnd } = useDND();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [showRefinement, setShowRefinement] = useState(false);
  const [timelineOverlayOpen, setTimelineOverlayOpen] = useState(false);
  const refinementEnabled = typeof window !== 'undefined' &&
    localStorage.getItem('fintheon-refinement-enabled') === 'true';
  const [missionControlCollapsed, setMissionControlCollapsedRaw] = useState(false);
  // 4c: Link Strategium ↔ RiskFlow collapse — always in sync
  const setMissionControlCollapsed = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    setMissionControlCollapsedRaw((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      setRiskFlowCollapsed(next);
      return next;
    });
  }, []);
  const [tapeCollapsed, setTapeCollapsed] = useState(false);
  const [combinedPanelCollapsed, setCombinedPanelCollapsed] = useState(false);
  const [tabTransitioning, setTabTransitioning] = useState(false);
  const [prevTab, setPrevTab] = useState<NavTab | null>(null);
  const [topStepXEnabled, setTopStepXEnabled] = useState(false);
  const [browserTransitioning, setBrowserTransitioning] = useState(false);
  const [browserVisible, setBrowserVisible] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<TradingPlatform>(defaultPlatform);
  const [secondaryPlatform, setSecondaryPlatform] = useState<TradingPlatform>('research');
  const [splitBrowserView, setSplitBrowserView] = useState(false);
  const [layoutOption, setLayoutOption] = useState<LayoutOption>(defaultLayout);
  const [prevLayoutOption, setPrevLayoutOption] = useState<LayoutOption | null>(null);
  const [missionControlPosition, setMissionControlPosition] = useState<PanelPosition>('right');
  const [tapePosition, setTapePosition] = useState<PanelPosition>('right');
  const [ivData, setIvData] = useState<IVScoreResponse | null>(null);
  const [ivLoading, setIvLoading] = useState(true);
  const [showMissionControlNotification, setShowMissionControlNotification] = useState(false);
  const [showTapeNotification, setShowTapeNotification] = useState(false);
  const [combinedPanelErScore, setCombinedPanelErScore] = useState(0);
  const [combinedPanelPnl, setCombinedPanelPnl] = useState(0);
  const [combinedPanelAlgoEnabled, setCombinedPanelAlgoEnabled] = useState(false);
  const [riskFlowCollapsed, setRiskFlowCollapsed] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showVoiceWidget, setShowVoiceWidget] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showYouTubeMiniplayer, setShowYouTubeMiniplayer] = useState(() => {
    try { return localStorage.getItem('fintheon:yt-miniplayer-open') === 'true'; } catch { return false; }
  });
  const [sidebarOverlayVisible, setSidebarOverlayVisible] = useState(false);
  const [missionWidgetOrder, setMissionWidgetOrderState] = useState<MissionWidgetId[]>(() =>
    normalizeOrder(getMissionWidgetOrder(), DEFAULT_MISSION_WIDGET_ORDER)
  );
  const [missionWidgetVisibility, setMissionWidgetVisibilityState] = useState<Record<MissionWidgetId, boolean>>(getMissionWidgetVisibility);
  const [psychAssistTarget, setPsychAssistTarget] = useState<PsychAssistDockTarget>(() => {
    try {
      return (localStorage.getItem('fintheon:psychassist-target:v1') as PsychAssistDockTarget) || 'floating';
    } catch {
      return 'floating';
    }
  });
  const [voiceWidgetTarget, setVoiceWidgetTarget] = useState<VoiceWidgetDockTarget>(() => {
    try {
      return (localStorage.getItem('fintheon:voice-widget-target:v1') as VoiceWidgetDockTarget) || 'floating';
    } catch {
      return 'floating';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('fintheon:psychassist-target:v1', psychAssistTarget);
    } catch {
      // ignore
    }
  }, [psychAssistTarget]);

  useEffect(() => {
    try {
      localStorage.setItem('fintheon:voice-widget-target:v1', voiceWidgetTarget);
    } catch {
      // ignore
    }
  }, [voiceWidgetTarget]);

  useEffect(() => {
    setMissionWidgetOrderState((prev) => normalizeOrder(prev, DEFAULT_MISSION_WIDGET_ORDER));
  }, []);

  // Tab history for breadcrumb back/forward navigation
  const [tabHistory, setTabHistory] = useState<NavTab[]>(['dashboard']);
  const [historyIndex, setHistoryIndex] = useState(0);

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
  const { alerts: riskFlowAlerts, removeAlert } = useRiskFlow();
  const [combinedTapeCollapsed, setCombinedTapeCollapsed] = useState(false);

  /* ---- Keyboard shortcuts ---- */
  useEffect(() => {
    const TAB_MAP: Record<string, NavTab> = {
      '1': 'dashboard',
      '2': 'analysis',
      '3': 'riskflow',
      '4': 'econ',
      '5': 'performance',
      '6': 'settings',
    };

    const handler = (e: KeyboardEvent) => {
      // Cmd+Shift+Y -> YouTube miniplayer
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        setShowYouTubeMiniplayer((v) => {
          const next = !v;
          try { localStorage.setItem('fintheon:yt-miniplayer-open', String(next)); } catch { /* ignore */ }
          return next;
        });
        return;
      }
      // Cmd+K -> Search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal((v) => !v);
        return;
      }
      // Ctrl+Shift+D -> Toggle DND
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        toggleManualDnd();
        return;
      }
      // Cmd+Shift+1-5 -> Tab navigation
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && TAB_MAP[e.key]) {
        e.preventDefault();
        navigateTab(TAB_MAP[e.key]);
        return;
      }
      // Esc -> Close modals
      if (e.key === 'Escape') {
        setShowSearchModal(false);
        setNotificationCenterOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-DND: activate when trading mode is on, flush queue when it turns off
  useEffect(() => {
    setAutoDnd(topStepXEnabled);
    if (!topStepXEnabled) {
      // Trading mode just turned off — flush queued notifications as stacked toasts (max 5)
      flushQueue();
    }
  }, [topStepXEnabled, setAutoDnd, flushQueue]);

  // Reset layout when TopStepX is toggled
  useEffect(() => {
    if (topStepXEnabled) {
      setMissionControlPosition('right');
      setTapePosition('right');
      setLayoutOption('combined');
    } else {
      setMissionControlPosition('right');
      setTapePosition('right');
      setMissionControlCollapsed(false);
      setTapeCollapsed(false);
    }
  }, [topStepXEnabled]);

  useEffect(() => {
    if (layoutOption === 'combined' && prevLayoutOption !== layoutOption) {
      setCombinedPanelCollapsed(false);
    }
    setPrevLayoutOption(layoutOption);
  }, [layoutOption, prevLayoutOption]);

  // Fetch blended IV score from backend for floating widget
  useEffect(() => {
    const fetchIVScore = async () => {
      try {
        const data = await backend.marketData.getIVScore();
        setIvData(data);
      } catch (error) {
        console.warn('[IV] Failed to fetch IV score:', error);
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
        console.warn('Failed to fetch account:', err);
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
    window.addEventListener('erScoreUpdate', handleERUpdate as EventListener);
    return () => {
      window.removeEventListener('erScoreUpdate', handleERUpdate as EventListener);
    };
  }, []);

  // Normalize ER score from -10 to 10 range to 0-1 range for display
  const normalizedCombinedPanelResonance = Math.max(0, Math.min(1, (combinedPanelErScore + 10) / 20));

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
      const { signOut } = await import('../../lib/supabase');
      await signOut();
      // Force reload to reset all state and show login screen
      window.location.reload();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Determine layout based on TopStepX state and layout option
  const showMissionControl = topStepXEnabled && missionControlPosition !== 'floating';
  const showTape = topStepXEnabled && tapePosition !== 'floating';
  const showFloatingWidget = topStepXEnabled && layoutOption === 'tickers-only';
  const showCombinedPanel = topStepXEnabled && layoutOption === 'combined';

  // Determine panel order based on position and layout option
  const leftPanels: React.ReactNode[] = [];
  const rightPanels: React.ReactNode[] = [];

  const handleMissionWidgetReorder = useCallback((order: MissionWidgetId[]) => {
    const normalized = normalizeOrder(order, DEFAULT_MISSION_WIDGET_ORDER);
    setMissionWidgetOrderState(normalized);
    setMissionWidgetOrder(normalized);
  }, []);

  const handleMissionWidgetToggleVisibility = useCallback((id: MissionWidgetId) => {
    setMissionWidgetVisibilityState((prev) => {
      const next = { ...prev, [id]: !(prev[id] !== false) };
      setMissionWidgetVisibility(next);
      return next;
    });
  }, []);


  const missionWidgetRegistry = useMemo(() => ({
    er: {
      id: 'er' as const,
      label: 'Emotional Resonance',
      node: <EmotionalResonanceMonitor onERScoreChange={setCombinedPanelErScore} />,
    },
    autopilot: {
      id: 'autopilot' as const,
      label: 'Autopilot',
      node: <AlgoStatusWidget />,
    },
    regime: {
      id: 'regime' as const,
      label: 'Regime Tracker',
      node: (
        <div className="space-y-2">
          <RegimeMini />
          <MiniProposalCard onExpand={() => handleTabChange('proposals')} />
        </div>
      ),
    },
    account: {
      id: 'account' as const,
      label: 'Account Tracker',
      node: <AccountTrackerWidget />,
    },
    blindspots: {
      id: 'blindspots' as const,
      label: 'Blindspots',
      node: <BlindspotsWidget />,
    },
    calendar: {
      id: 'calendar' as const,
      label: 'Session Calendar',
      node: <SessionCalendarMini />,
    },
  }), []);

  const orderedMissionWidgets = useMemo(() => {
    const normalized = normalizeOrder(missionWidgetOrder, DEFAULT_MISSION_WIDGET_ORDER);
    return normalized
      .filter((id) => missionWidgetVisibility[id] !== false)
      .map((id) => missionWidgetRegistry[id]);
  }, [missionWidgetOrder, missionWidgetRegistry, missionWidgetVisibility]);

  // Full list (including hidden) for the arrange menu
  const allMissionWidgets = useMemo(() => {
    const normalized = normalizeOrder(missionWidgetOrder, DEFAULT_MISSION_WIDGET_ORDER);
    return normalized.map((id) => ({ id, label: missionWidgetRegistry[id].label }));
  }, [missionWidgetOrder, missionWidgetRegistry]);

  const renderMissionControl = useCallback((collapseFn?: () => void) => (
    <MissionControlContent
      orderedMissionWidgets={orderedMissionWidgets}
      allMissionWidgets={allMissionWidgets}
      missionWidgetVisibility={missionWidgetVisibility}
      onReorder={handleMissionWidgetReorder}
      onToggleVisibility={handleMissionWidgetToggleVisibility}
      collapseFn={collapseFn}
    />
  ), [orderedMissionWidgets, allMissionWidgets, missionWidgetVisibility, handleMissionWidgetReorder, handleMissionWidgetToggleVisibility]);

  // When TopStepX is enabled, render panels based on layout option
  if (topStepXEnabled) {
    if (layoutOption === 'combined') {
      // Combined panel: Mission Control + The Tape in one scroll (split, no overlap)
      rightPanels.push(
        <div key="combined" className={`bg-[var(--fintheon-surface)] border-l border-[var(--fintheon-accent)]/10 transition-all duration-200 ${combinedPanelCollapsed ? 'w-16' : 'w-[380px]'}`}>
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
                <section className={`${combinedTapeCollapsed ? 'flex-1' : 'h-1/2'} min-h-0 overflow-y-auto border-b border-[var(--fintheon-accent)]/20`}>
                  <div className="p-3 h-full">
                    {renderMissionControl(() => setCombinedPanelCollapsed(true))}
                  </div>
                </section>
                {/* RiskFlow: 50% when expanded, 168px collapsed preview at bottom */}
                <section className={`${combinedTapeCollapsed ? 'h-[168px] shrink-0' : 'h-1/2'} min-h-0 flex flex-col`}>
                  <RiskFlowMini
                    collapsed={combinedTapeCollapsed}
                    onToggleCollapsed={() => setCombinedTapeCollapsed(!combinedTapeCollapsed)}
                    onNavigateToFeed={() => navigateTab('riskflow')}
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
        </div>
      );
    }
    // For 'tickers-only', no panels are shown (only floating widget)
  } else {
    // When TopStepX is disabled: right stack = Mission Control + collapsible RiskFlow
    const hideRightPanel = showRefinement || activeTab === 'analysis' || activeTab === 'econ' || activeTab === 'narrative' || activeTab === 'apparatus' || activeTab === 'performance' || activeTab === 'proposals' || activeTab === 'settings';
    if (!hideRightPanel) {
      rightPanels.push(
        <div
          key="right-stack"
          className={`flex-shrink-0 h-full min-w-0 flex flex-col border-l border-[var(--fintheon-accent)]/10 transition-[width] duration-300 ease-in-out overflow-hidden ${
            missionControlCollapsed ? 'w-12 bg-[var(--fintheon-bg)]' : 'w-[380px]'
          }`}
        >
          {missionControlCollapsed ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <button
                onClick={() => setMissionControlCollapsed(false)}
                className="p-2 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
                title="Expand Strategium"
              >
                <ChevronLeft className="w-4 h-4 text-[var(--fintheon-accent)]/60" />
              </button>
            </div>
          ) : (
            <>
              <div className={`${riskFlowCollapsed ? 'flex-1' : 'h-1/2'} flex flex-col transition-all duration-300 bg-[var(--fintheon-surface)]`}>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="p-3 h-full">
                    {renderMissionControl(() => setMissionControlCollapsed(true))}
                  </div>
                </div>
              </div>
              <div className={`${riskFlowCollapsed ? 'h-[168px] shrink-0' : 'h-1/2'} flex flex-col transition-all duration-300`}>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <RiskFlowMini
                    collapsed={riskFlowCollapsed}
                    onToggleCollapsed={() => setRiskFlowCollapsed((v) => !v)}
                    onNavigateToFeed={() => navigateTab('riskflow')}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      );
    }
  }

  return (
    <ScheduleProvider>
    <div className={`h-screen flex flex-col bg-[var(--fintheon-bg)] text-white ${topStepXEnabled ? 'topstepx-active' : ''}`}>
      <TopHeader
        topStepXEnabled={topStepXEnabled}
        onTopStepXToggle={handleBrowserEnable} // [claude-code 2026-03-16] Restore: clicking platform in dropdown enables iframe
        onTopStepXDisable={handleBrowserToggle}
        selectedPlatform={selectedPlatform}
        onPlatformSelect={setSelectedPlatform}
        layoutOption={layoutOption}
        onLayoutOptionChange={setLayoutOption}
        chatOpen={showChat}
        onChatToggle={() => setShowChat(prev => {
          // Opening chat in Castra → auto-switch to Zen so panels don't fight for space
          if (!prev && topStepXEnabled && layoutOption === 'combined') {
            setLayoutOption('tickers-only');
          }
          return !prev;
        })}
        activeTab={activeTab}
        tabHistory={tabHistory}
        historyIndex={historyIndex}
        onBack={goBack}
        onForward={goForward}
        hideBranding={topStepXEnabled && sidebarOverlayVisible}
        toolbarEditMode={layoutEditMode}
        voiceRoomWidget={voiceEnabled ? (
          showVoiceWidget && voiceWidgetTarget === 'header' ? (
            <VoiceWidget
              target="header"
              onDockToHeader={() => setVoiceWidgetTarget('header')}
              onUndockToFloating={() => setVoiceWidgetTarget('floating')}
              onClose={() => setShowVoiceWidget(false)}
            />
          ) : (
            <VoiceRoomHeaderButton
              onClick={() => setShowVoiceWidget((v) => !v)}
              participantCount={0}
              joined={showVoiceWidget}
            />
          )
        ) : undefined}
        psychAssistHeadingWidget={
          topStepXEnabled && layoutOption === 'tickers-only' && psychAssistTarget === 'header' ? (
            <PsychAssistDockable
              target="header"
              onDockToHeader={() => setPsychAssistTarget('header')}
              onUndockToFloating={() => setPsychAssistTarget('floating')}
            />
          ) : undefined
        }
      />

      {/* S14-T6: Peers panel removed — team status is now in footer Team tab */}

      <div className="flex-1 flex overflow-hidden relative">
        <div className="relative">
          <NavSidebar
            activeTab={activeTab}
            onTabChange={(tab) => { setShowRefinement(false); handleTabChange(tab); }}
            onLogout={handleLogout}
            topStepXEnabled={topStepXEnabled}
            onOverlayVisibilityChange={setSidebarOverlayVisible}
            onEditModeChange={setLayoutEditMode}
            onNotificationCenterToggle={() => setNotificationCenterOpen((v) => !v)}
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
        {leftPanels.length > 0 && (
          <div className="flex">
            {leftPanels}
          </div>
        )}

        {/* Center Content - TopStepX or Main Content with crossfade */}
        <div className="flex-1 overflow-hidden relative min-w-0 flex flex-col">
          {/* Timeline overlay — slides over browser, does not affect iframe sizing */}
          <TimelineOverlay open={timelineOverlayOpen} onClose={() => setTimelineOverlayOpen(false)} />
          {topStepXEnabled && !timelineOverlayOpen && (
            <TimelineToggleButton onClick={() => setTimelineOverlayOpen(true)} />
          )}

          {/* Browser layer */}
          {topStepXEnabled && (
            <div className={`absolute inset-0 z-10 ${isStone ? 'bg-black' : ''} ${browserVisible ? 'animate-browser-in' : 'animate-browser-out'}`}>
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
          <div className={`h-full relative flex-1 flex flex-col ${topStepXEnabled ? 'pointer-events-none' : ''}`} style={{ opacity: topStepXEnabled ? 0 : 1, transition: 'opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1)' }}>
              <TabRenderer
                activeTab={activeTab}
                tabTransitioning={tabTransitioning}
                prevTab={prevTab}
                showRefinement={showRefinement}
                navigateTab={navigateTab}
              />
            </div>
        </div>

        {/* Right Panels */}
        {rightPanels.length > 0 && (
          <div className="flex">
            {rightPanels}
          </div>
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

        {showVoiceWidget && voiceWidgetTarget === 'floating' && (
          <VoiceWidget
            target="floating"
            onDockToHeader={() => setVoiceWidgetTarget('header')}
            onUndockToFloating={() => setVoiceWidgetTarget('floating')}
            onClose={() => setShowVoiceWidget(false)}
          />
        )}

        {/* Zen Layout: dockable PsychAssist widget (float ↔ header) */}
        {topStepXEnabled && layoutOption === 'tickers-only' && psychAssistTarget === 'floating' && (
          <PsychAssistDockable
            target="floating"
            onDockToHeader={() => setPsychAssistTarget('header')}
            onUndockToFloating={() => setPsychAssistTarget('floating')}
          />
        )}

        {/* Panel Notification Widgets */}
        {showMissionControlNotification && (
          <PanelNotificationWidget
            panelName="Mission Control"
            onRestore={() => {
              setMissionControlPosition('right');
              setShowMissionControlNotification(false);
            }}
            onDismiss={() => setShowMissionControlNotification(false)}
          />
        )}
        {showTapeNotification && (
          <PanelNotificationWidget
            panelName="RiskFlow"
            onRestore={() => {
              setTapePosition('right');
              setShowTapeNotification(false);
            }}
            onDismiss={() => setShowTapeNotification(false)}
          />
        )}

        {/* YouTube floating miniplayer — persists independent of TradingBrowser */}
        {showYouTubeMiniplayer && (
          <YouTubeMiniplayer onClose={() => {
            setShowYouTubeMiniplayer(false);
            try { localStorage.setItem('fintheon:yt-miniplayer-open', 'false'); } catch { /* ignore */ }
          }} />
        )}

        {/* Global chat panel — slide in/out from right */}
        <ChatPanel showChat={showChat} onClose={() => setShowChat(false)} navigateTab={(tab) => navigateTab(tab as NavTab)} />
      </div>

      <SessionCountdownWidget />

      <FooterToolbar
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
        <div style={{ position: 'fixed', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
          <EmbeddedBrowserFrame title="TopStepX (preload)" src="https://www.topstepx.com" />
          <EmbeddedBrowserFrame title="Research (preload)" src={iframeUrls.research || import.meta.env.VITE_NOTION_RESEARCH_URL || 'https://www.notion.so'} />
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

      {/* Team onboarding — auto-shows on first run or version update */}
      {/* TeamOnboarding permanently removed — security risk, exposes Supabase credentials
      <TeamOnboarding
        open={false}
        onClose={() => {}}
        onComplete={() => {}}
      /> */}
    </div>
    </ScheduleProvider>
  );
}
