// [claude-code 2026-04-03] Spring-physics CSS transitions for dropdowns, tab content, side panels
// [claude-code 2026-04-03] S14-T3: Consilium restructure — Boardroom + Apparatus as dropdowns
// [claude-code 2026-03-30] Wire narratives from NarrativeContext → Sanctum (Aquarium)
// [claude-code 2026-03-28] S7: Sanctum dropdown (NarrativeFlow/Aquarium/Timeline) inside Consilium tab bar
import { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { MessageSquare, Users, Clock, GitBranch, Cpu, PanelRightOpen, PanelRightClose, ChevronDown, Fish, Zap, Shield, Brain, BookOpen } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { AgentChattr } from './AgentChattr';
import { Sanctum } from '../narrative/Sanctum';
import { TimelinePanel } from '../narrative/TimelinePanel';
import { ProposalWidget } from '../proposals/ProposalWidget';
import { MiroSharkDebatePanel } from '../miroshark/MiroSharkDebatePanel';
import { NarrativeMap } from '../narrative/NarrativeMap';
import { NarrativeProvider, useNarrative } from '../../contexts/NarrativeContext';
import { ApparatusFlowMap } from '../apparatus/ApparatusFlowMap';
import { BulletinFeed } from '../bulletin/BulletinFeed';
import { EmbeddedBrowserFrame } from '../layout/EmbeddedBrowserFrame';
import { SharedMemoryPanel } from '../memory/SharedMemoryPanel';
import { AiLoader } from '../chat/FintheonThread';
import type { SanctumData, SanctumPreset, SimulationContext, RiskFlowCatalyst, SanctumNarrative } from '../../types/miroshark';

import { ChatSidebar } from '../chat/ChatSidebar';
const ResearchBoard = lazy(() => import('../research/ResearchBoard'));

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Top-level tabs: Sanctum, Boardroom, Apparatus are dropdowns; Chat is a direct button
type ConsiliumTab = 'sanctum' | 'chat' | 'boardroom' | 'apparatus';
type SanctumSubView = 'narratives' | 'aquarium' | 'timeline';
type BoardroomSubView = 'forum' | 'imperium' | 'agentic-chat' | 'research';
type ApparatusSubView = 'desk' | 'fileroom';

// Chat is the only direct button now
const REGULAR_TABS: { id: ConsiliumTab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
];

const SANCTUM_SUB_VIEWS: { id: SanctumSubView; label: string; subtitle?: string; icon: typeof GitBranch }[] = [
  { id: 'timeline', label: 'Timeline', subtitle: 'Track the catalysts', icon: Clock },
  { id: 'narratives', label: 'NarrativeFlow', subtitle: 'Visualize the situation', icon: GitBranch },
  { id: 'aquarium', label: 'Aquarium', subtitle: 'The Shark Tank. Deliberate it.', icon: Fish },
];

const BOARDROOM_SUB_VIEWS: { id: BoardroomSubView; label: string; subtitle?: string; icon: typeof MessageSquare }[] = [
  { id: 'forum', label: 'Forum', subtitle: 'Team bulletin & chat', icon: MessageSquare },
  { id: 'imperium', label: 'Imperium', subtitle: 'Task command & assignment', icon: Shield },
  { id: 'agentic-chat', label: 'Agentic Chatroom', subtitle: 'Chat with Hermes & CAO', icon: Cpu },
  { id: 'research', label: 'Research', subtitle: 'Notion knowledge base', icon: BookOpen },
];

const APPARATUS_SUB_VIEWS: { id: ApparatusSubView; label: string; subtitle?: string; icon: typeof Cpu }[] = [
  { id: 'desk', label: 'Desk', subtitle: 'Agent dossiers & monitoring', icon: Users },
  { id: 'fileroom', label: 'Fileroom', subtitle: 'AI-generated context bank', icon: Brain },
];

/** Bridge: reads NarrativeContext lanes → SanctumNarrative[] for Sanctum (Aquarium) */
function SanctumWithNarratives(props: Omit<React.ComponentProps<typeof Sanctum>, 'narratives' | 'catalysts'>) {
  const { state, healthScores } = useNarrative();
  const narratives = useMemo<SanctumNarrative[]>(() =>
    state.lanes.map(lane => ({
      id: lane.id,
      title: lane.title,
      category: lane.category,
      directionBias: lane.directionBias,
      healthScore: healthScores[lane.id] ?? lane.healthScore,
      instruments: lane.instruments,
      status: lane.status,
      dateRange: lane.dateRange,
    })),
    [state.lanes, healthScores]
  );
  const catalysts = useMemo(() =>
    state.catalysts.map(c => ({
      id: c.id,
      title: c.title,
      date: c.date,
      sentiment: c.sentiment,
      severity: c.severity,
      category: c.category,
      narrativeIds: c.narrativeIds,
    })),
    [state.catalysts]
  );
  return <Sanctum {...props} narratives={narratives} catalysts={catalysts} />;
}

function usePanelState(key: string, defaultValue: boolean): [boolean, () => void] {
  const [state, setState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch { return defaultValue; }
  });

  const toggle = useCallback(() => {
    setState((prev) => {
      const next = !prev;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, [key]);

  return [state, toggle];
}

export function ConsiliumHub() {
  const { selectedSymbol, iframeUrls } = useSettings();
  const [activeTab, setActiveTab] = useState<ConsiliumTab>('chat');
  const [sanctumSubView, setSanctumSubView] = useState<SanctumSubView>('narratives');
  const [boardroomSubView, setBoardroomSubView] = useState<BoardroomSubView>('forum');
  const [apparatusSubView, setApparatusSubView] = useState<ApparatusSubView>('desk');
  const [displayedTab, setDisplayedTab] = useState<ConsiliumTab>('chat');
  const [displayedSubView, setDisplayedSubView] = useState<SanctumSubView>('narratives');
  const [displayedBoardroomSub, setDisplayedBoardroomSub] = useState<BoardroomSubView>('forum');
  const [displayedApparatusSub, setDisplayedApparatusSub] = useState<ApparatusSubView>('desk');
  const [sanctumDropdownOpen, setSanctumDropdownOpen] = useState(false);
  const [boardroomDropdownOpen, setBoardroomDropdownOpen] = useState(false);
  const [apparatusDropdownOpen, setApparatusDropdownOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [mirosharkData, setMirosharkData] = useState<SanctumData | null>(null);
  const [riskflowItems, setRiskflowItems] = useState<RiskFlowCatalyst[]>([]);
  const [macroContext, setMacroContext] = useState<SimulationContext | null>(null);
  type ActivePanel = 'proposals' | 'debate' | null;
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const showProposals = activePanel === 'proposals';
  const showDebate = activePanel === 'debate';
  const toggleProposals = useCallback(() => setActivePanel(prev => prev === 'proposals' ? null : 'proposals'), []);
  const toggleDebate = useCallback(() => setActivePanel(prev => prev === 'debate' ? null : 'debate'), []);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdowns on outside click
  const sanctumDropdownRef = useRef<HTMLDivElement>(null);
  const boardroomDropdownRef = useRef<HTMLDivElement>(null);
  const apparatusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anyOpen = sanctumDropdownOpen || boardroomDropdownOpen || apparatusDropdownOpen;
    if (!anyOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (sanctumDropdownOpen && sanctumDropdownRef.current && !sanctumDropdownRef.current.contains(target)) {
        setSanctumDropdownOpen(false);
      }
      if (boardroomDropdownOpen && boardroomDropdownRef.current && !boardroomDropdownRef.current.contains(target)) {
        setBoardroomDropdownOpen(false);
      }
      if (apparatusDropdownOpen && apparatusDropdownRef.current && !apparatusDropdownRef.current.contains(target)) {
        setApparatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sanctumDropdownOpen, boardroomDropdownOpen, apparatusDropdownOpen]);

  // Tab transition: fade out (150ms) → swap content → fade in (200ms)
  const handleTabChange = useCallback((tab: ConsiliumTab) => {
    if (tab === activeTab && tab !== 'sanctum') return;
    setTransitioning(true);
    setActiveTab(tab);
    if (transitionRef.current) clearTimeout(transitionRef.current);
    transitionRef.current = setTimeout(() => {
      setDisplayedTab(tab);
      setTransitioning(false);
    }, 150);
  }, [activeTab]);

  const handleSanctumSubChange = useCallback((sub: SanctumSubView) => {
    setSanctumSubView(sub);
    setSanctumDropdownOpen(false);
    if (activeTab !== 'sanctum') {
      setActiveTab('sanctum');
    }
    setTransitioning(true);
    if (transitionRef.current) clearTimeout(transitionRef.current);
    transitionRef.current = setTimeout(() => {
      setDisplayedTab('sanctum');
      setDisplayedSubView(sub);
      setTransitioning(false);
    }, 150);
  }, [activeTab]);

  const handleBoardroomSubChange = useCallback((sub: BoardroomSubView) => {
    setBoardroomSubView(sub);
    setBoardroomDropdownOpen(false);
    if (activeTab !== 'boardroom') {
      setActiveTab('boardroom');
    }
    setTransitioning(true);
    if (transitionRef.current) clearTimeout(transitionRef.current);
    transitionRef.current = setTimeout(() => {
      setDisplayedTab('boardroom');
      setDisplayedBoardroomSub(sub);
      setTransitioning(false);
    }, 150);
  }, [activeTab]);

  const handleApparatusSubChange = useCallback((sub: ApparatusSubView) => {
    setApparatusSubView(sub);
    setApparatusDropdownOpen(false);
    if (activeTab !== 'apparatus') {
      setActiveTab('apparatus');
    }
    setTransitioning(true);
    if (transitionRef.current) clearTimeout(transitionRef.current);
    transitionRef.current = setTimeout(() => {
      setDisplayedTab('apparatus');
      setDisplayedApparatusSub(sub);
      setTransitioning(false);
    }, 150);
  }, [activeTab]);

  useEffect(() => {
    return () => { if (transitionRef.current) clearTimeout(transitionRef.current); };
  }, []);

  // Fetch market context on mount
  const fetchContext = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/miroshark/context`);
      if (res.ok) {
        const ctx = await res.json();
        setMacroContext(ctx);
        if (ctx.riskflowHeadlines) setRiskflowItems(ctx.riskflowHeadlines);
      }
    } catch (err) {
      console.warn('[ConsiliumHub] Context fetch failed:', err);
    }
  }, []);

  useEffect(() => { fetchContext(); }, [fetchContext]);

  // Load persisted MiroShark report on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/miroshark/latest`);
        if (!res.ok) return;
        const report = await res.json();
        if (cancelled || !report) return;
        setMirosharkData({
          simulationId: report.simulationId ?? '',
          status: 'complete',
          compositeIV: report.compositeIV ?? 0,
          confidence: report.confidence ?? 0,
          regimeShiftProbability: report.regimeShiftProbability ?? 0,
          categoryScores: report.categoryScores ?? [],
          timeSeries: report.timeSeries ?? [],
          generatedEvents: report.generatedEvents ?? [],
          scenarios: report.scenarios ?? [],
          briefing: report.briefing ?? null,
          contextSnapshot: report.contextSnapshot ?? null,
        });
      } catch (err) {
        console.warn('[ConsiliumHub] Failed to load persisted MiroShark report:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleRunMiroShark = useCallback(async (preset?: SanctumPreset) => {
    setMirosharkData(prev => prev
      ? { ...prev, status: 'running' }
      : { simulationId: '', status: 'running', compositeIV: 0, confidence: 0, regimeShiftProbability: 0, categoryScores: [], timeSeries: [], generatedEvents: [], scenarios: [] }
    );

    try {
      // Check for a recent run (<12h) by ANY user before triggering a new simulation
      const staleRes = await fetch(`${API_BASE}/api/miroshark/auto-run-check`);
      if (staleRes.ok) {
        const { shouldRun, staleness } = await staleRes.json();
        if (!shouldRun) {
          console.log(`[MiroShark] Recent run exists (${staleness.toFixed(1)}h ago) — loading latest`);
          const latestRes = await fetch(`${API_BASE}/api/miroshark/latest`);
          if (latestRes.ok) {
            const report = await latestRes.json();
            if (report) {
              setMirosharkData({
                simulationId: report.simulationId ?? '',
                status: 'complete',
                compositeIV: report.compositeIV ?? 0,
                confidence: report.confidence ?? 0,
                regimeShiftProbability: report.regimeShiftProbability ?? 0,
                categoryScores: report.categoryScores ?? [],
                timeSeries: report.timeSeries ?? [],
                generatedEvents: report.generatedEvents ?? [],
                scenarios: report.scenarios ?? [],
                briefing: report.briefing ?? null,
                contextSnapshot: report.contextSnapshot ?? null,
              });
              fetchContext();
              return;
            }
          }
        }
      }

      const simRes = await fetch(`${API_BASE}/api/miroshark/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preset: preset ?? 'full-brief',
          narrativeState: { lanes: [], catalysts: [], ropes: [] },
        }),
      });

      if (!simRes.ok) throw new Error(`Simulation failed: ${simRes.status}`);
      const { simulationId } = await simRes.json();

      const reportRes = await fetch(`${API_BASE}/api/miroshark/report/${simulationId}`);
      if (!reportRes.ok) throw new Error(`Report fetch failed: ${reportRes.status}`);
      const report = await reportRes.json();

      setMirosharkData({
        simulationId,
        status: 'complete',
        compositeIV: report.nextSessionScore ?? 5,
        confidence: report.confidence ?? 0.5,
        regimeShiftProbability: report.regimeShiftProbability ?? 0.1,
        categoryScores: report.categoryScores ?? [],
        timeSeries: report.timeSeries ?? [],
        generatedEvents: report.generatedEvents ?? [],
        scenarios: report.scenarios ?? [],
        briefing: report.briefing ?? null,
        contextSnapshot: report.contextSnapshot ?? null,
      });

      // Refresh context after simulation
      fetchContext();
    } catch (err) {
      console.error('[MiroShark] Run failed:', err);
      // Only set error status if user had existing data (preserves idle state on auto-run failure)
      setMirosharkData(prev => prev
        ? { ...prev, status: 'error', error: err instanceof Error ? err.message : 'Unknown error' }
        : null
      );
    }
  }, [fetchContext]);

  const activeSanctumSub = SANCTUM_SUB_VIEWS.find(v => v.id === sanctumSubView) ?? SANCTUM_SUB_VIEWS[0];
  const SanctumIcon = activeSanctumSub.icon;

  return (
    <div className="flex h-full flex-col bg-[var(--fintheon-bg)]">
      {/* Tab bar: Sanctum dropdown + regular tabs + Proposals toggle */}
      <div className="flex items-center gap-0.5 px-4 pt-3 pb-1">
        <h2 className="mr-3 text-sm font-medium uppercase tracking-[0.2em] text-[var(--fintheon-accent)]" style={{ fontFamily: 'var(--font-heading, Roboto, sans-serif)' }}>
          Consilium
        </h2>

        {/* Chat button (direct) */}
        {REGULAR_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === id
                ? 'text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30'
                : 'border border-transparent text-[var(--fintheon-text)]/40 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]/70'
            }`}
            style={{ fontFamily: 'var(--font-body, Roboto, sans-serif)' }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}

        {/* Sanctum tab with dropdown */}
        <div ref={sanctumDropdownRef} className="relative">
          <button
            onClick={() => setSanctumDropdownOpen(v => !v)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'sanctum'
                ? 'text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30'
                : 'border border-transparent text-[var(--fintheon-text)]/40 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]/70'
            }`}
            style={{ fontFamily: 'var(--font-body, Roboto, sans-serif)' }}
          >
            <Zap size={13} />
            Sanctum
            <ChevronDown size={10} className={`opacity-50 transition-transform ${sanctumDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          <div
            className="absolute top-full left-0 mt-1 z-50 min-w-[220px] rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl overflow-hidden"
            style={{
              opacity: sanctumDropdownOpen ? 1 : 0,
              transform: sanctumDropdownOpen ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(0.97)',
              pointerEvents: sanctumDropdownOpen ? 'auto' : 'none',
              transition: 'opacity 180ms var(--ease-spring), transform 180ms var(--ease-spring)',
            }}
          >
            {SANCTUM_SUB_VIEWS.map(({ id, label, subtitle, icon: Icon }, idx) => (
              <button
                key={id}
                onClick={() => handleSanctumSubChange(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                  sanctumSubView === id && activeTab === 'sanctum'
                    ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10'
                    : 'text-[var(--fintheon-text)]/50 hover:text-[var(--fintheon-text)]/80 hover:bg-[var(--fintheon-accent)]/5'
                }`}
                style={{
                  opacity: sanctumDropdownOpen ? 1 : 0,
                  transform: sanctumDropdownOpen ? 'translateX(0)' : 'translateX(-6px)',
                  transition: `opacity 200ms var(--ease-spring) ${idx * 40}ms, transform 200ms var(--ease-spring) ${idx * 40}ms`,
                }}
              >
                <Icon size={13} className="shrink-0 mt-0.5" />
                <div className="flex flex-col items-start">
                  <span className="font-medium">{label}</span>
                  {subtitle && <span className="text-[10px] opacity-40 leading-tight">{subtitle}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Boardroom dropdown */}
        <div ref={boardroomDropdownRef} className="relative">
          <button
            onClick={() => setBoardroomDropdownOpen(v => !v)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'boardroom'
                ? 'text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30'
                : 'border border-transparent text-[var(--fintheon-text)]/40 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]/70'
            }`}
            style={{ fontFamily: 'var(--font-body, Roboto, sans-serif)' }}
          >
            <Users size={13} />
            Boardroom
            <ChevronDown size={10} className={`opacity-50 transition-transform ${boardroomDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          <div
            className="absolute top-full left-0 mt-1 z-50 min-w-[200px] rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl overflow-hidden"
            style={{
              opacity: boardroomDropdownOpen ? 1 : 0,
              transform: boardroomDropdownOpen ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(0.97)',
              pointerEvents: boardroomDropdownOpen ? 'auto' : 'none',
              transition: 'opacity 180ms var(--ease-spring), transform 180ms var(--ease-spring)',
            }}
          >
            {BOARDROOM_SUB_VIEWS.map(({ id, label, subtitle, icon: Icon }, idx) => (
              <button
                key={id}
                onClick={() => handleBoardroomSubChange(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                  boardroomSubView === id && activeTab === 'boardroom'
                    ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10'
                    : 'text-[var(--fintheon-text)]/50 hover:text-[var(--fintheon-text)]/80 hover:bg-[var(--fintheon-accent)]/5'
                }`}
                style={{
                  opacity: boardroomDropdownOpen ? 1 : 0,
                  transform: boardroomDropdownOpen ? 'translateX(0)' : 'translateX(-6px)',
                  transition: `opacity 200ms var(--ease-spring) ${idx * 40}ms, transform 200ms var(--ease-spring) ${idx * 40}ms`,
                }}
              >
                <Icon size={13} className="shrink-0 mt-0.5" />
                <div className="flex flex-col items-start">
                  <span className="font-medium">{label}</span>
                  {subtitle && <span className="text-[10px] opacity-40 leading-tight">{subtitle}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Apparatus dropdown */}
        <div ref={apparatusDropdownRef} className="relative">
          <button
            onClick={() => setApparatusDropdownOpen(v => !v)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'apparatus'
                ? 'text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30'
                : 'border border-transparent text-[var(--fintheon-text)]/40 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]/70'
            }`}
            style={{ fontFamily: 'var(--font-body, Roboto, sans-serif)' }}
          >
            <Cpu size={13} />
            Apparatus
            <ChevronDown size={10} className={`opacity-50 transition-transform ${apparatusDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          <div
            className="absolute top-full left-0 mt-1 z-50 min-w-[210px] rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl overflow-hidden"
            style={{
              opacity: apparatusDropdownOpen ? 1 : 0,
              transform: apparatusDropdownOpen ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(0.97)',
              pointerEvents: apparatusDropdownOpen ? 'auto' : 'none',
              transition: 'opacity 180ms var(--ease-spring), transform 180ms var(--ease-spring)',
            }}
          >
            {APPARATUS_SUB_VIEWS.map(({ id, label, subtitle, icon: Icon }, idx) => (
              <button
                key={id}
                onClick={() => handleApparatusSubChange(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                  apparatusSubView === id && activeTab === 'apparatus'
                    ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10'
                    : 'text-[var(--fintheon-text)]/50 hover:text-[var(--fintheon-text)]/80 hover:bg-[var(--fintheon-accent)]/5'
                }`}
                style={{
                  opacity: apparatusDropdownOpen ? 1 : 0,
                  transform: apparatusDropdownOpen ? 'translateX(0)' : 'translateX(-6px)',
                  transition: `opacity 200ms var(--ease-spring) ${idx * 40}ms, transform 200ms var(--ease-spring) ${idx * 40}ms`,
                }}
              >
                <Icon size={13} className="shrink-0 mt-0.5" />
                <div className="flex flex-col items-start">
                  <span className="font-medium">{label}</span>
                  {subtitle && <span className="text-[10px] opacity-40 leading-tight">{subtitle}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1" />

        {activeTab === 'sanctum' && (
          <button
            onClick={toggleDebate}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              showDebate
                ? 'text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30'
                : 'border border-transparent text-[var(--fintheon-accent)]/40 hover:text-[var(--fintheon-accent)]/70 hover:bg-[var(--fintheon-accent)]/5'
            }`}
            title={showDebate ? 'Hide Debate' : 'Show Debate'}
          >
            <Shield size={14} />
            Debate
          </button>
        )}


        <button
          onClick={toggleProposals}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            showProposals
              ? 'text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30'
              : 'border border-transparent text-[var(--fintheon-accent)]/40 hover:text-[var(--fintheon-accent)]/70 hover:bg-[var(--fintheon-accent)]/5'
          }`}
          title={showProposals ? 'Hide Proposals' : 'Show Proposals'}
        >
          {showProposals ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          Proposals
        </button>
      </div>

      {/* Tab content + Proposals panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className="flex-1 min-h-0 min-w-0 overflow-hidden"
          style={{
            opacity: transitioning ? 0 : 1,
            transform: transitioning ? 'translateY(6px)' : 'translateY(0)',
            transition: 'opacity 220ms var(--ease-spring), transform 220ms var(--ease-spring)',
          }}
        >
          {/* Sanctum sub-views — shared NarrativeProvider so seeds carry across views */}
          {displayedTab === 'sanctum' && (
            <NarrativeProvider>
              {displayedSubView === 'narratives' && <NarrativeMap />}
              {displayedSubView === 'aquarium' && (
                <SanctumWithNarratives
                  data={mirosharkData}
                  onRun={handleRunMiroShark}
                  riskflowItems={riskflowItems}
                  macroContext={macroContext}
                  selectedSymbol={selectedSymbol.symbol}
                />
              )}
              {displayedSubView === 'timeline' && <TimelinePanel />}
            </NarrativeProvider>
          )}

          {/* Chat */}
          {displayedTab === 'chat' && (
            <div className="h-full w-full max-w-3xl mx-auto">
              <ChatSidebar />
            </div>
          )}

          {/* Boardroom sub-views */}
          {displayedTab === 'boardroom' && (
            <>
              {displayedBoardroomSub === 'forum' && <BulletinFeed />}
              {displayedBoardroomSub === 'imperium' && (
                <Suspense fallback={<AiLoader />}>
                  <ResearchBoard />
                </Suspense>
              )}
              {displayedBoardroomSub === 'agentic-chat' && <AgentChattr />}
              {displayedBoardroomSub === 'research' && (
                <EmbeddedBrowserFrame
                  title="Research"
                  src={iframeUrls.research || 'https://www.notion.so/2db141b0da7d80efa647ee7f6d5153f5'}
                  className="w-full h-full"
                />
              )}
            </>
          )}

          {/* Apparatus sub-views */}
          {displayedTab === 'apparatus' && (
            <>
              {displayedApparatusSub === 'desk' && <ApparatusFlowMap />}
              {displayedApparatusSub === 'fileroom' && <SharedMemoryPanel mode="fileroom" />}
            </>
          )}
        </div>

        {/* Collapsible Debate panel */}
        <div
          className={`flex-shrink-0 overflow-hidden border-l border-[var(--fintheon-accent)]/10 ${
            showDebate ? 'w-80' : 'w-0 border-l-0'
          }`}
          style={{ transition: 'width 280ms var(--ease-spring), border-width 280ms' }}
        >
          <div
            className="w-80 h-full overflow-hidden bg-[var(--fintheon-bg)]"
            style={{
              opacity: showDebate ? 1 : 0,
              transition: 'opacity 200ms ease 80ms',
            }}
          >
            <MiroSharkDebatePanel simulationId={mirosharkData?.simulationId ?? null} />
          </div>
        </div>

        {/* Collapsible Proposals + Scorecards right panel */}
        <div
          className={`flex-shrink-0 overflow-hidden border-l border-[var(--fintheon-accent)]/10 ${
            showProposals ? 'w-80' : 'w-0 border-l-0'
          }`}
          style={{ transition: 'width 280ms var(--ease-spring), border-width 280ms' }}
        >
          <div
            className="w-80 h-full overflow-y-auto bg-[var(--fintheon-bg)]"
            style={{
              opacity: showProposals ? 1 : 0,
              transition: 'opacity 200ms ease 80ms',
            }}
          >
            <ProposalWidget />
          </div>
        </div>
      </div>
    </div>
  );
}
