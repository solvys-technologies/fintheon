// [claude-code 2026-03-30] Wire narratives from NarrativeContext → Sanctum (Aquarium)
// [claude-code 2026-03-28] S7: Sanctum dropdown (NarrativeFlow/Aquarium/Timeline) inside Consilium tab bar
// [claude-code 2026-03-24] Persistence refactor: load latest report on mount, persist after simulation
// [claude-code 2026-03-24] Thread selectedSymbol from settings into Sanctum for TradingView chart
import { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { MessageSquare, Users, Clock, GitBranch, Cpu, PanelRightOpen, PanelRightClose, ChevronDown, Fish, Zap, Shield, SlidersHorizontal } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { AgentChattr } from './AgentChattr';
import { Sanctum } from '../narrative/Sanctum';
import { TimelinePanel } from '../narrative/TimelinePanel';
import { ProposalWidget } from '../proposals/ProposalWidget';
import { MiroSharkDebatePanel } from '../miroshark/MiroSharkDebatePanel';
import { NarrativeMap } from '../narrative/NarrativeMap';
import { NarrativeProvider, useNarrative } from '../../contexts/NarrativeContext';
import { ApparatusFlowMap } from '../apparatus/ApparatusFlowMap';
import { AiLoader } from '../chat/FintheonThread';
import { SanctumFilterPanel } from '../narrative/SanctumFilterPanel';
import type { SanctumData, SanctumPreset, SimulationContext, RiskFlowCatalyst, SanctumNarrative } from '../../types/miroshark';

const ChatInterface = lazy(() => import('../ChatInterface'));

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Top-level tabs: Sanctum is a dropdown, others are direct tabs
type ConsiliumTab = 'sanctum' | 'chat' | 'boardroom' | 'apparatus';
// Sanctum sub-views (inside the dropdown)
type SanctumSubView = 'narratives' | 'aquarium' | 'timeline';

const REGULAR_TABS: { id: ConsiliumTab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Ask Harp', icon: MessageSquare },
  { id: 'boardroom', label: 'Boardroom', icon: Users },
  { id: 'apparatus', label: 'Apparatus', icon: Cpu },
];

const SANCTUM_SUB_VIEWS: { id: SanctumSubView; label: string; subtitle?: string; icon: typeof GitBranch }[] = [
  { id: 'narratives', label: 'NarrativeMap', icon: GitBranch },
  { id: 'aquarium', label: 'Aquarium', subtitle: 'shark tank', icon: Fish },
  { id: 'timeline', label: 'Timeline', icon: Clock },
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
  const { selectedSymbol } = useSettings();
  const [activeTab, setActiveTab] = useState<ConsiliumTab>('chat');
  const [sanctumSubView, setSanctumSubView] = useState<SanctumSubView>('narratives');
  const [displayedTab, setDisplayedTab] = useState<ConsiliumTab>('chat');
  const [displayedSubView, setDisplayedSubView] = useState<SanctumSubView>('narratives');
  const [sanctumDropdownOpen, setSanctumDropdownOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [mirosharkData, setMirosharkData] = useState<SanctumData | null>(null);
  const [riskflowItems, setRiskflowItems] = useState<RiskFlowCatalyst[]>([]);
  const [macroContext, setMacroContext] = useState<SimulationContext | null>(null);
  // Only one slide-out panel at a time (proposals or debate)
  type ActivePanel = 'proposals' | 'debate' | null;
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const showProposals = activePanel === 'proposals';
  const showDebate = activePanel === 'debate';
  const toggleProposals = useCallback(() => setActivePanel(prev => prev === 'proposals' ? null : 'proposals'), []);
  const toggleDebate = useCallback(() => setActivePanel(prev => prev === 'debate' ? null : 'debate'), []);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLButtonElement>(null);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close Sanctum dropdown on outside click
  const sanctumDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sanctumDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (sanctumDropdownRef.current && !sanctumDropdownRef.current.contains(e.target as Node)) {
        setSanctumDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sanctumDropdownOpen]);

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

        {/* Sanctum tab with dropdown */}
        <div ref={sanctumDropdownRef} className="relative">
          <button
            onClick={() => { handleTabChange('sanctum'); setSanctumDropdownOpen(v => !v); }}
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

          {sanctumDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl overflow-hidden">
              {SANCTUM_SUB_VIEWS.map(({ id, label, subtitle, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleSanctumSubChange(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                    sanctumSubView === id && activeTab === 'sanctum'
                      ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10'
                      : 'text-[var(--fintheon-text)]/50 hover:text-[var(--fintheon-text)]/80 hover:bg-[var(--fintheon-accent)]/5'
                  }`}
                >
                  <Icon size={13} />
                  <span className="font-medium">{label}</span>
                  {subtitle && <span className="italic text-[10px] opacity-50">{subtitle}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Regular tabs: Chat, Boardroom, Scorecards, Apparatus */}
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

        <div className="flex-1" />

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

        {/* FILTERS dropdown — only functional when Sanctum is active */}
        <div className="relative">
          <button
            ref={filtersRef}
            onClick={() => setFiltersOpen(prev => !prev)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              filtersOpen
                ? 'text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30'
                : 'border border-transparent text-[var(--fintheon-accent)]/40 hover:text-[var(--fintheon-accent)]/70 hover:bg-[var(--fintheon-accent)]/5'
            }`}
            title="Map Filters"
          >
            <SlidersHorizontal size={14} />
            Filters
          </button>
          {filtersOpen && activeTab === 'sanctum' && (
            <SanctumFilterPanel
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              anchorRef={filtersRef}
            />
          )}
        </div>

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
          style={{ opacity: transitioning ? 0 : 1, transition: 'opacity 200ms ease' }}
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

          {/* Regular tabs */}
          {displayedTab === 'chat' && (
            <Suspense fallback={<AiLoader />}>
              <ChatInterface surfaceId="askharp" />
            </Suspense>
          )}
          {displayedTab === 'boardroom' && <AgentChattr />}
          {displayedTab === 'apparatus' && <ApparatusFlowMap />}
        </div>

        {/* Collapsible Debate panel */}
        <div
          className={`flex-shrink-0 overflow-hidden transition-[width] duration-[240ms] ease-in-out border-l border-[var(--fintheon-accent)]/10 ${
            showDebate ? 'w-80' : 'w-0 border-l-0'
          }`}
        >
          <div className="w-80 h-full overflow-hidden bg-[var(--fintheon-bg)]">
            <MiroSharkDebatePanel simulationId={mirosharkData?.simulationId ?? null} />
          </div>
        </div>

        {/* Collapsible Proposals + Scorecards right panel */}
        <div
          className={`flex-shrink-0 overflow-hidden transition-[width] duration-[240ms] ease-in-out border-l border-[var(--fintheon-accent)]/10 ${
            showProposals ? 'w-80' : 'w-0 border-l-0'
          }`}
        >
          <div className="w-80 h-full overflow-y-auto bg-[var(--fintheon-bg)]">
            <ProposalWidget />
          </div>
        </div>
      </div>
    </div>
  );
}
