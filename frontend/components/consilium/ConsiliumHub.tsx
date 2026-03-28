// [claude-code 2026-03-28] S7: Sanctum overhaul — dropdown nav, NarrativeFlow default, Aquarium rename
// [claude-code 2026-03-24] Persistence refactor: load latest report on mount, persist after simulation
// [claude-code 2026-03-24] Thread selectedSymbol from settings into Sanctum for TradingView chart
import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { MessageSquare, Users, LineChart, Clock, GitBranch, Cpu, PanelRightOpen, PanelRightClose, ChevronDown, Fish } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { AgentChattr } from './AgentChattr';
import { DevelopmentsTimeline } from './DevelopmentsTimeline';
import { Sanctum } from '../narrative/Sanctum';
import { TimelinePanel } from '../narrative/TimelinePanel';
import { ProposalWidget } from '../proposals/ProposalWidget';
import { NarrativeFlow } from '../narrative/NarrativeFlow';
import { NarrativeProvider } from '../../contexts/NarrativeContext';
import { ApparatusPage } from '../apparatus/ApparatusPage';
import { AiLoader } from '../chat/FintheonThread';
import type { SanctumData, SanctumPreset, SimulationContext, RiskFlowCatalyst } from '../../types/mirofish';

const ChatInterface = lazy(() => import('../ChatInterface'));

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

type SanctumView = 'narratives' | 'aquarium' | 'timeline' | 'chat' | 'boardroom' | 'apparatus';

const SANCTUM_VIEWS: { id: SanctumView; label: string; subtitle?: string; icon: typeof MessageSquare }[] = [
  { id: 'narratives', label: 'NarrativeFlow', icon: GitBranch },
  { id: 'aquarium', label: 'Aquarium', subtitle: 'shark tank', icon: Fish },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'chat', label: 'Ask Harp', icon: MessageSquare },
  { id: 'boardroom', label: 'Boardroom', icon: Users },
  { id: 'apparatus', label: 'Apparatus', icon: Cpu },
];

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
  const [activeView, setActiveView] = useState<SanctumView>('narratives');
  const [displayedView, setDisplayedView] = useState<SanctumView>('narratives');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [mirofishData, setMirofishData] = useState<SanctumData | null>(null);
  const [riskflowItems, setRiskflowItems] = useState<RiskFlowCatalyst[]>([]);
  const [macroContext, setMacroContext] = useState<SimulationContext | null>(null);
  const [showProposals, toggleProposals] = usePanelState('fintheon:consilium:proposals-panel', false);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  // View transition: fade out (150ms) → swap content → fade in (200ms)
  const handleViewChange = useCallback((view: SanctumView) => {
    if (view === activeView) return;
    setTransitioning(true);
    setActiveView(view);
    setDropdownOpen(false);
    if (transitionRef.current) clearTimeout(transitionRef.current);
    transitionRef.current = setTimeout(() => {
      setDisplayedView(view);
      setTransitioning(false);
    }, 150);
  }, [activeView]);

  useEffect(() => {
    return () => { if (transitionRef.current) clearTimeout(transitionRef.current); };
  }, []);

  // Fetch market context on mount
  const fetchContext = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/mirofish/context`);
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

  // Load persisted MiroFish report on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/mirofish/latest`);
        if (!res.ok) return;
        const report = await res.json();
        if (cancelled || !report) return;
        setMirofishData({
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
        console.warn('[ConsiliumHub] Failed to load persisted MiroFish report:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleRunMiroFish = useCallback(async (preset?: SanctumPreset) => {
    setMirofishData(prev => prev
      ? { ...prev, status: 'running' }
      : { simulationId: '', status: 'running', compositeIV: 0, confidence: 0, regimeShiftProbability: 0, categoryScores: [], timeSeries: [], generatedEvents: [], scenarios: [] }
    );

    try {
      const simRes = await fetch(`${API_BASE}/api/mirofish/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preset: preset ?? 'full-brief',
          narrativeState: { lanes: [], catalysts: [], ropes: [] },
        }),
      });

      if (!simRes.ok) throw new Error(`Simulation failed: ${simRes.status}`);
      const { simulationId } = await simRes.json();

      const reportRes = await fetch(`${API_BASE}/api/mirofish/report/${simulationId}`);
      if (!reportRes.ok) throw new Error(`Report fetch failed: ${reportRes.status}`);
      const report = await reportRes.json();

      setMirofishData({
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
      console.error('[MiroFish] Run failed:', err);
      setMirofishData(prev => prev
        ? { ...prev, status: 'error', error: err instanceof Error ? err.message : 'Unknown error' }
        : null
      );
    }
  }, [fetchContext]);

  const activeViewConfig = SANCTUM_VIEWS.find(v => v.id === activeView) ?? SANCTUM_VIEWS[0];
  const ActiveIcon = activeViewConfig.icon;

  return (
    <div className="flex h-full flex-col bg-[var(--fintheon-bg)]">
      {/* Header: Sanctum title + dropdown + Proposals toggle */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--fintheon-accent)]" style={{ fontFamily: 'var(--font-heading, Roboto, sans-serif)' }}>
          Sanctum
        </h2>

        {/* View selector dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/5"
            style={{ fontFamily: 'var(--font-body, Roboto, sans-serif)' }}
          >
            <ActiveIcon size={13} />
            <span>{activeViewConfig.label}</span>
            {activeViewConfig.subtitle && (
              <span className="italic text-[var(--fintheon-accent)]/50 text-[10px]">{activeViewConfig.subtitle}</span>
            )}
            <ChevronDown size={12} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl overflow-hidden">
              {SANCTUM_VIEWS.map(({ id, label, subtitle, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleViewChange(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                    activeView === id
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

        <div className="flex-1" />

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

      {/* View content + Proposals panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className="flex-1 min-h-0 min-w-0 overflow-hidden"
          style={{ opacity: transitioning ? 0 : 1, transition: 'opacity 200ms ease' }}
        >
          {displayedView === 'narratives' && (
            <NarrativeProvider>
              <NarrativeFlow />
            </NarrativeProvider>
          )}
          {displayedView === 'aquarium' && (
            <Sanctum
              data={mirofishData}
              onRun={handleRunMiroFish}
              catalysts={[]}
              riskflowItems={riskflowItems}
              macroContext={macroContext}
              selectedSymbol={selectedSymbol.symbol}
            />
          )}
          {displayedView === 'timeline' && (
            <NarrativeProvider>
              <TimelinePanel />
            </NarrativeProvider>
          )}
          {displayedView === 'chat' && (
            <Suspense fallback={<AiLoader />}>
              <ChatInterface surfaceId="askharp" />
            </Suspense>
          )}
          {displayedView === 'boardroom' && <AgentChattr />}
          {displayedView === 'apparatus' && <ApparatusPage />}
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
