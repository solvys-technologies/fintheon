// [claude-code 2026-02-26] Support dockable PsychAssist in Zen layout.
// [claude-code 2026-03-11] Track 4: MC overhaul — no Panels header, collapse in MC header, 50/50 flex, gear menu
// [claude-code 2026-03-11] T3d: removed auto-enable from platform dropdown — power controlled via dedicated button only
// [claude-code 2026-03-20] S3:T4c: Linked Strategium ↔ RiskFlow collapse — both expand/collapse together
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from 'lucide-react';
import type { IVScoreResponse } from '../../types/market-data';
import { TopHeader } from './TopHeader';
import { NavSidebar } from './NavSidebar';
import { MinimalFeedSection } from '../feed/MinimalFeedSection';
import { CompactRiskFlowCard } from '../feed/CompactRiskFlowCard';
import { KanbanTitle } from '../ui/KanbanTitle';
import { MinimalTapeWidget } from '../feed/MinimalTapeWidget';
import { NewsSection } from '../feed/NewsSection';
import { ConsiliumHub } from '../consilium/ConsiliumHub';
import { TopStepXBrowser, type TradingPlatform } from '../TopStepXBrowser';
import { FloatingWidget } from './FloatingWidget';
import { PanelPosition } from './DraggablePanel';
import { useBackend } from '../../lib/backend';
import { EmotionalResonanceMonitor } from '../mission-control/EmotionalResonanceMonitor';
import { BlindspotsWidget } from '../mission-control/BlindspotsWidget';
import { AccountTrackerWidget } from '../mission-control/AccountTrackerWidget';
import { AlgoStatusWidget } from '../mission-control/AlgoStatusWidget';
import { PanelNotificationWidget } from './PanelNotificationWidget';
import { MinimalERMeter } from '../MinimalERMeter';
import { ExecutiveDashboard } from '../executive/ExecutiveDashboard';
import { ResearchDepartment } from '../executive/ResearchDepartment';
import { SectionBreadcrumb } from './SectionBreadcrumb';
import RiskFlowPanel from '../RiskFlowPanel';
import { useRiskFlow } from '../../contexts/RiskFlowContext';
import { SearchModal } from '../search/SearchModal';
import { AskHarpChatPanel } from '../chat/AskHarpChatPanel';
import { SettingsPage } from '../SettingsPanel';
import { useSettings } from '../../contexts/SettingsContext';
import { PsychAssistDockable, type PsychAssistDockTarget } from './PsychAssistDockable';
import { FooterToolbar } from './FooterToolbar';
import { EmbeddedBrowserFrame } from './EmbeddedBrowserFrame';
import { ScheduleProvider } from '../../contexts/ScheduleContext';
import { EconCalendarProvider } from '../../contexts/EconCalendarContext';
import { EconCalendar } from '../econ/EconCalendar';
import { NarrativeProvider } from '../../contexts/NarrativeContext';
import { NarrativeFlow } from '../narrative/NarrativeFlow';
import { TradingJournal } from '../journal/TradingJournal';
import { ProposalWidget } from '../proposals/ProposalWidget';
import { ApparatusPage } from '../apparatus/ApparatusPage';
import { FirstTimeTour } from '../onboarding/FirstTimeTour';
// [claude-code 2026-03-16] Hermes moved from standalone page into Settings tab
import { SessionCountdownWidget } from '../mission-control/SessionCountdownWidget';
import { RegimeMini } from '../mission-control/RegimeMini';
import { MiniProposalCard } from '../mission-control/MiniProposalCard';
import { SessionCalendarMini } from '../mission-control/SessionCalendarMini';
import { WidgetArrangeMenu } from '../mission-control/WidgetArrangeMenu';
import { DNDProvider, useDND } from '../../contexts/DNDContext';
import { NotificationCenter } from '../NotificationCenter';
import {
  DEFAULT_MISSION_WIDGET_ORDER,
  getMissionWidgetOrder,
  setMissionWidgetOrder,
  getMissionWidgetVisibility,
  setMissionWidgetVisibility,
  type MissionWidgetId,
} from '../../lib/layoutOrderStorage';

type NavTab = 'feed' | 'analysis' | 'news' | 'executive' | 'notion' | 'econ' | 'narrative' | 'apparatus' | 'earnings' | 'proposals' | 'settings';
type LayoutOption = 'tickers-only' | 'combined';

const MISSION_WIDGETS_PER_PAGE = 2;

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
  const { iframeUrls } = useSettings();
  const { setAutoDnd, flushQueue, toggleManualDnd } = useDND();
  const [activeTab, setActiveTab] = useState<NavTab>('executive');
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
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
  const [selectedPlatform, setSelectedPlatform] = useState<TradingPlatform>('topstepx');
  const [secondaryPlatform, setSecondaryPlatform] = useState<TradingPlatform>('research');
  const [splitBrowserView, setSplitBrowserView] = useState(false);
  const [layoutOption, setLayoutOption] = useState<LayoutOption>('combined');
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
  const [showAskHarp, setShowAskHarp] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [sidebarOverlayVisible, setSidebarOverlayVisible] = useState(false);
  const [missionWidgetOrder, setMissionWidgetOrderState] = useState<MissionWidgetId[]>(() =>
    normalizeOrder(getMissionWidgetOrder(), DEFAULT_MISSION_WIDGET_ORDER)
  );
  const [missionWidgetVisibility, setMissionWidgetVisibilityState] = useState<Record<MissionWidgetId, boolean>>(getMissionWidgetVisibility);
  const [missionDeckPage, setMissionDeckPage] = useState(0);
  const missionDeckRef = useRef<HTMLDivElement>(null);
  const [psychAssistTarget, setPsychAssistTarget] = useState<PsychAssistDockTarget>(() => {
    try {
      return (localStorage.getItem('fintheon:psychassist-target:v1') as PsychAssistDockTarget) || 'floating';
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
    setMissionWidgetOrderState((prev) => normalizeOrder(prev, DEFAULT_MISSION_WIDGET_ORDER));
  }, []);

  // Tab history for breadcrumb back/forward navigation
  const [tabHistory, setTabHistory] = useState<NavTab[]>(['executive']);
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
  const { alerts: riskFlowAlerts, removeAlert } = useRiskFlow();
  const [combinedTapeCollapsed, setCombinedTapeCollapsed] = useState(false);

  /* ---- Keyboard shortcuts ---- */
  useEffect(() => {
    const TAB_MAP: Record<string, NavTab> = {
      '1': 'executive',
      '2': 'analysis',
      '3': 'news',
      '4': 'econ',
      '6': 'notion',
      '7': 'narrative',
    };

    const handler = (e: KeyboardEvent) => {
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

  // Fetch account data for combined panel collapsed state
  useEffect(() => {
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
  }, [backend]);

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
    // No-op in local single-user mode
    console.log('Logout not available in local mode');
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

  const missionWidgetPages = useMemo(() => {
    const pages: Array<typeof orderedMissionWidgets> = [];
    for (let i = 0; i < orderedMissionWidgets.length; i += MISSION_WIDGETS_PER_PAGE) {
      pages.push(orderedMissionWidgets.slice(i, i + MISSION_WIDGETS_PER_PAGE));
    }
    return pages.length > 0 ? pages : [[]];
  }, [orderedMissionWidgets]);

  useEffect(() => {
    setMissionDeckPage((prev) => Math.min(prev, Math.max(0, missionWidgetPages.length - 1)));
  }, [missionWidgetPages.length]);

  const scrollMissionDeckToPage = useCallback((idx: number) => {
    setMissionDeckPage(idx);
    const el = missionDeckRef.current;
    if (!el) return;
    const pages = el.querySelectorAll('[data-mission-page]');
    if (pages[idx]) {
      pages[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleMissionDeckScroll = useCallback(() => {
    const el = missionDeckRef.current;
    if (!el) return;
    const pages = el.querySelectorAll('[data-mission-page]');
    let closest = 0;
    let minDist = Infinity;
    pages.forEach((page, idx) => {
      const rect = page.getBoundingClientRect();
      const offset = Math.abs(rect.top - el.getBoundingClientRect().top);
      if (offset < minDist) {
        minDist = offset;
        closest = idx;
      }
    });
    setMissionDeckPage(closest);
  }, []);

  // Reusable Mission Control content block: snap deck with exactly 2 widgets per page.
  const missionControlContent = (collapseFn?: () => void) => (
    <div className="h-full flex flex-col" data-tour-target="strategium">
      <KanbanTitle
        title="Strategium"
        tone="gold"
        headerRight={
          <div className="flex items-center gap-0.5">
            <WidgetArrangeMenu
              widgets={allMissionWidgets}
              visibility={missionWidgetVisibility}
              onReorder={handleMissionWidgetReorder}
              onToggleVisibility={handleMissionWidgetToggleVisibility}
            />
            {collapseFn && (
              <button
                onClick={collapseFn}
                className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
                title="Collapse panel"
              >
                <ChevronRight className="w-3.5 h-3.5 text-[var(--fintheon-accent)]/60" />
              </button>
            )}
          </div>
        }
      />

      <div className="mt-2 flex-1 min-h-0 relative">
        <div
          ref={missionDeckRef}
          onScroll={handleMissionDeckScroll}
          className="h-full overflow-y-auto snap-y snap-mandatory border-y border-[var(--fintheon-accent)]/15"
        >
          {missionWidgetPages.map((page, pageIdx) => (
            <section
              key={`mission-page-${pageIdx}`}
              data-mission-page={pageIdx}
              className="min-h-full snap-start grid grid-rows-2 divide-y divide-[var(--fintheon-accent)]/15"
            >
              {[0, 1].map((slotIdx) => {
                const widget = page[slotIdx];
                if (!widget) {
                  return <div key={`slot-${slotIdx}`} className="p-3" />;
                }
                return (
                  <div key={widget.id} className="p-3">
                    {widget.node}
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        {missionWidgetPages.length > 1 && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-2">
            {missionWidgetPages.map((_, idx) => (
              <button
                key={`mission-dot-${idx}`}
                onClick={() => scrollMissionDeckToPage(idx)}
                title={`Mission page ${idx + 1}`}
                className="group relative flex items-center justify-center"
              >
                <div
                  className={`transition-all duration-300 rounded-full ${
                    missionDeckPage === idx
                      ? 'w-[3px] h-8 bg-[var(--fintheon-accent)]'
                      : 'w-[2px] h-5 bg-gray-700 hover:bg-gray-500'
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // When TopStepX is enabled, render panels based on layout option
  if (topStepXEnabled) {
    if (layoutOption === 'combined') {
      // Combined panel: Mission Control + The Tape in one scroll (split, no overlap)
      rightPanels.push(
        <div key="combined" className={`bg-[var(--fintheon-surface)] border-l border-[var(--fintheon-accent)]/20 transition-all duration-200 ${combinedPanelCollapsed ? 'w-16' : 'w-[380px]'}`}>
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
                    {missionControlContent(() => setCombinedPanelCollapsed(true))}
                  </div>
                </section>
                {/* The Tape: 50% when expanded, collapsed header when hidden */}
                <section className={`${combinedTapeCollapsed ? 'flex-shrink-0' : 'h-1/2'} min-h-0 flex flex-col border-t border-[var(--fintheon-accent)]/20`}>
                  <button
                    type="button"
                    onClick={() => setCombinedTapeCollapsed(!combinedTapeCollapsed)}
                    className="h-10 flex-shrink-0 flex items-center justify-between px-3 border-b border-[var(--fintheon-accent)]/20 hover:bg-[var(--fintheon-accent)]/5 transition-colors w-full text-left"
                  >
                    <span className="text-[11px] font-semibold text-[var(--fintheon-accent)] tracking-[0.2em] uppercase">The Tape</span>
                    {combinedTapeCollapsed && riskFlowAlerts.length > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500/30 text-red-400 text-[10px] font-bold">
                        {riskFlowAlerts.length}
                      </span>
                    )}
                    <span className="text-[var(--fintheon-accent)]/60">
                      {combinedTapeCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                  {!combinedTapeCollapsed && (
                    <div className="flex-1 min-h-0 overflow-y-auto px-1 py-1.5 space-y-0.5">
                      {riskFlowAlerts.length === 0 ? (
                        <div className="text-center text-zinc-600 py-6 text-[10px]">No items</div>
                      ) : (
                        riskFlowAlerts.slice(0, 30).map((alert) => (
                          <CompactRiskFlowCard key={alert.id} alert={alert} onDismiss={removeAlert} />
                        ))
                      )}
                    </div>
                  )}
                  {combinedTapeCollapsed && (
                    <div className="p-3 flex justify-center">
                      <div className="w-full max-w-[120px]">
                        <MinimalTapeWidget />
                      </div>
                    </div>
                  )}
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
    const hideRightPanel = activeTab === 'notion' || activeTab === 'econ' || activeTab === 'narrative' || activeTab === 'apparatus' || activeTab === 'earnings' || activeTab === 'proposals' || activeTab === 'settings';
    if (!hideRightPanel) {
      if (missionControlCollapsed) {
        // Strategium collapsed — entire right panel collapses (RiskFlow always collapses with it)
        rightPanels.push(
          <div key="right-stack" className="w-12 flex-shrink-0 h-full min-w-0 flex flex-col items-center justify-center border-l border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)]">
            <button
              onClick={() => setMissionControlCollapsed(false)}
              className="p-2 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
              title="Expand Strategium"
            >
              <ChevronLeft className="w-4 h-4 text-[var(--fintheon-accent)]/60" />
            </button>
          </div>
        );
      } else if (riskFlowCollapsed) {
        rightPanels.push(
          <div key="right-stack" className="w-[380px] flex-shrink-0 h-full min-w-0 flex flex-col border-l border-[var(--fintheon-accent)]/15">
            <div className="flex-1 min-h-0 overflow-y-auto border-b border-[var(--fintheon-accent)]/20">
              <div className="p-3 h-full">
                {missionControlContent(() => setMissionControlCollapsed(true))}
              </div>
            </div>
            <div className="h-[168px] shrink-0 border-t border-[var(--fintheon-accent)]/20">
              <RiskFlowPanel
                collapsed={riskFlowCollapsed}
                onToggleCollapsed={() => setRiskFlowCollapsed((v) => !v)}
              />
            </div>
          </div>
        );
      } else {
        rightPanels.push(
          <div key="right-stack" className="w-[380px] flex-shrink-0 h-full min-w-0 flex flex-col border-l border-[var(--fintheon-accent)]/15">
            <div className="h-1/2 flex flex-col border-b border-[var(--fintheon-accent)]/20">
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-3 h-full">
                  {missionControlContent(() => setMissionControlCollapsed(true))}
                </div>
              </div>
            </div>
            <div className="h-1/2 flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto">
                <RiskFlowPanel
                  collapsed={riskFlowCollapsed}
                  onToggleCollapsed={() => setRiskFlowCollapsed((v) => !v)}
                />
              </div>
            </div>
          </div>
        );
      }
    }
  }

  return (
    <ScheduleProvider>
    <div className="h-screen flex flex-col bg-[var(--fintheon-bg)] text-white">
      <TopHeader
        topStepXEnabled={topStepXEnabled}
        onTopStepXToggle={() => setTopStepXEnabled(true)} // [claude-code 2026-03-16] Restore: clicking platform in dropdown enables iframe
        onTopStepXDisable={() => setTopStepXEnabled(prev => !prev)}
        selectedPlatform={selectedPlatform}
        onPlatformSelect={setSelectedPlatform}
        layoutOption={layoutOption}
        onLayoutOptionChange={setLayoutOption}
        askHarpOpen={showAskHarp}
        onAskHarpToggle={() => setShowAskHarp(prev => {
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

      <div className="flex-1 flex overflow-hidden relative">
        <div className="relative">
          <NavSidebar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onLogout={handleLogout}
            topStepXEnabled={topStepXEnabled}
            onOverlayVisibilityChange={setSidebarOverlayVisible}
            onEditModeChange={setLayoutEditMode}
            onNotificationCenterToggle={() => setNotificationCenterOpen((v) => !v)}
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

        {/* Center Content - TopStepX or Main Content */}
        <div className="flex-1 overflow-hidden relative min-w-0 flex flex-col">
          {topStepXEnabled ? (
            <div className="h-full w-full flex-1 p-0 min-h-0">
              <TopStepXBrowser
                primaryPlatform={selectedPlatform}
                onPrimaryPlatformChange={setSelectedPlatform}
                secondaryPlatform={secondaryPlatform}
                onSecondaryPlatformChange={setSecondaryPlatform}
                splitViewEnabled={splitBrowserView}
                onSplitViewEnabledChange={setSplitBrowserView}
                allowSplitView={topStepXEnabled}
              />
            </div>
          ) : (
            <div className="h-full relative flex-1 flex flex-col">
              <div className="flex-1 min-h-0 overflow-hidden">
              {activeTab === 'executive' && (
                <div key="executive" data-tour-target="executive" className={`h-full w-full section-fade-corners ${tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}`}>
                  <ExecutiveDashboard />
                </div>
              )}
              {activeTab === 'analysis' && (
                <div key="analysis" data-tour-target="chat" className={`h-full w-full section-fade-corners ${tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}`}>
                  <ConsiliumHub />
                </div>
              )}
              {activeTab === 'news' && (
                <div key="news" data-tour-target="riskflow" className={`h-full w-full section-fade-corners ${tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}`}>
                  <NewsSection />
                </div>
              )}
              {activeTab === 'econ' && (
                <div key="econ" data-tour-target="econ" className={`h-full w-full ${tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}`}>
                  <EconCalendarProvider>
                    <EconCalendar />
                  </EconCalendarProvider>
                </div>
              )}
              {activeTab === 'narrative' && (
                <div key="narrative" data-tour-target="narrative" className={`h-full w-full ${tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}`}>
                  <NarrativeProvider>
                    <NarrativeFlow />
                  </NarrativeProvider>
                </div>
              )}
              {activeTab === 'apparatus' && (
                <div key="apparatus" data-tour-target="apparatus" className={`h-full w-full ${tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}`}>
                  <ApparatusPage />
                </div>
              )}
              {activeTab === 'notion' && (
                <div key="notion" className={`h-full w-full ${tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}`}>
                  <ResearchDepartment />
                </div>
              )}
              {activeTab === 'proposals' && (
                <div key="proposals" data-tour-target="proposals" className={`h-full w-full ${tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}`}>
                  <ProposalWidget />
                </div>
              )}
              {activeTab === 'earnings' && (
                <div key="earnings" data-tour-target="performance" className={`h-full w-full ${tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}`}>
                  <TradingJournal />
                </div>
              )}
              {activeTab === 'settings' && (
                <div key="settings" className={`h-full w-full ${tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}`}>
                  <SettingsPage />
                </div>
              )}
              </div>
            </div>
          )}
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
            panelName="The Tape"
            onRestore={() => {
              setTapePosition('right');
              setShowTapeNotification(false);
            }}
            onDismiss={() => setShowTapeNotification(false)}
          />
        )}

        {/* Global chat panel (hidden on boardroom tab where it's already embedded) */}
        {showAskHarp && (
          <div className="absolute right-0 top-0 bottom-0 w-[360px] z-40 flex flex-col bg-[var(--fintheon-surface)] border-l border-[var(--fintheon-accent)]/20 shadow-2xl animate-fade-in-tab">
            <div className="flex items-center justify-end px-4 py-2 flex-shrink-0">
              <button
                onClick={() => setShowAskHarp(false)}
                className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-gray-400 hover:text-[var(--fintheon-accent)] transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <AskHarpChatPanel />
            </div>
          </div>
        )}
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
        onPowerOff={() => setTopStepXEnabled(false)}
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
    </div>
    </ScheduleProvider>
  );
}
