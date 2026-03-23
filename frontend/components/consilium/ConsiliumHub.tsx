// [claude-code 2026-03-22] Theme-consistent styling + tab fade cross-dissolve (350ms)
// [claude-code 2026-03-20] S3-FIX:T2 — Consilium mega-merge: 8 sub-tabs, floating tab bar, agent dropdown, UI polish
import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { MessageSquare, Users, LineChart, Clock, Trophy, Target, GitBranch, Cpu, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { AgentChattr } from './AgentChattr';
import { DevelopmentsTimeline } from './DevelopmentsTimeline';
import { AgentScorecard } from './AgentScorecard';
import { Auditorium } from '../narrative/Auditorium';
import { ProposalWidget } from '../proposals/ProposalWidget';
import { NarrativeFlow } from '../narrative/NarrativeFlow';
import { NarrativeProvider } from '../../contexts/NarrativeContext';
import { ApparatusPage } from '../apparatus/ApparatusPage';
import { AiLoader } from '../chat/FintheonThread';
import type { AuditoriumData } from '../../types/mirofish';

const ChatInterface = lazy(() => import('../ChatInterface'));

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

type ConsiliumTab = 'chat' | 'boardroom' | 'predictions' | 'timeline' | 'scorecards' | 'proposals' | 'narratives' | 'apparatus';

const TABS: { id: ConsiliumTab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'boardroom', label: 'Boardroom', icon: Users },
  { id: 'predictions', label: 'Predictions', icon: LineChart },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'scorecards', label: 'Scorecards', icon: Trophy },
  { id: 'proposals', label: 'Proposals', icon: Target },
  { id: 'narratives', label: 'Narratives', icon: GitBranch },
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
  const [activeTab, setActiveTab] = useState<ConsiliumTab>('chat');
  const [displayedTab, setDisplayedTab] = useState<ConsiliumTab>('chat');
  const [transitioning, setTransitioning] = useState(false);
  const [mirofishData, setMirofishData] = useState<AuditoriumData | null>(null);
  const [showProposals, toggleProposals] = usePanelState('fintheon:consilium:proposals-panel', false);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll active tab into view when it changes
  useEffect(() => {
    if (!tabBarRef.current) return;
    const activeBtn = tabBarRef.current.querySelector('[data-active="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  // Tab transition: fade out (150ms) → swap content → fade in (200ms) = ~350ms cross-dissolve
  const handleTabChange = useCallback((tab: ConsiliumTab) => {
    if (tab === activeTab) return;
    setTransitioning(true);
    setActiveTab(tab);
    if (transitionRef.current) clearTimeout(transitionRef.current);
    transitionRef.current = setTimeout(() => {
      setDisplayedTab(tab);
      setTransitioning(false);
    }, 150);
  }, [activeTab]);

  // Cleanup transition timeout on unmount
  useEffect(() => {
    return () => { if (transitionRef.current) clearTimeout(transitionRef.current); };
  }, []);

  const handleRunMiroFish = useCallback(async () => {
    setMirofishData(prev => prev
      ? { ...prev, status: 'running' }
      : { simulationId: '', status: 'running', compositeIV: 0, confidence: 0, regimeShiftProbability: 0, categoryScores: [], timeSeries: [], generatedEvents: [], scenarios: [] }
    );

    try {
      const simRes = await fetch(`${API_BASE}/api/mirofish/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narrativeState: { lanes: [], catalysts: [], ropes: [] } }),
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
      });
    } catch (err) {
      console.error('[MiroFish] Run failed:', err);
      setMirofishData(prev => prev
        ? { ...prev, status: 'error', error: err instanceof Error ? err.message : 'Unknown error' }
        : null
      );
    }
  }, []);

  return (
    <div className="flex h-full flex-col bg-[var(--fintheon-bg)]">
      {/* Floating tab bar — no borders, no separators, theme-sensitive */}
      <div className="flex items-center gap-0.5 px-4 pt-3 pb-1">
        <h2 className="mr-3 text-sm font-medium uppercase tracking-[0.2em] text-[var(--fintheon-accent)]" style={{ fontFamily: 'var(--font-heading, Roboto, sans-serif)' }}>
          Consilium
        </h2>

        {/* Scrollable tab strip */}
        <div
          ref={tabBarRef}
          className="flex items-center gap-0.5 overflow-x-auto scrollbar-none"
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              data-active={activeTab === id}
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
        </div>

        <div className="flex-1" />

        {/* Proposals panel toggle */}
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

      {/* Tab content + Proposals panel — no border between tab bar and content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main content area with fade transition */}
        <div
          className="flex-1 min-h-0 min-w-0 overflow-hidden"
          style={{ opacity: transitioning ? 0 : 1, transition: 'opacity 200ms ease' }}
        >
          {displayedTab === 'chat' && (
            <Suspense fallback={<AiLoader />}>
              <ChatInterface surfaceId="askharp" />
            </Suspense>
          )}
          {displayedTab === 'boardroom' && <AgentChattr />}
          {displayedTab === 'predictions' && (
            <div className="h-full [&>div]:w-full [&>div]:border-l-0">
              <Auditorium
                data={mirofishData}
                onRun={handleRunMiroFish}
                catalysts={[]}
              />
            </div>
          )}
          {displayedTab === 'timeline' && <DevelopmentsTimeline />}
          {displayedTab === 'scorecards' && <AgentScorecard />}
          {displayedTab === 'proposals' && (
            <div className="h-full overflow-y-auto">
              <ProposalWidget />
            </div>
          )}
          {displayedTab === 'narratives' && (
            <NarrativeProvider>
              <NarrativeFlow />
            </NarrativeProvider>
          )}
          {displayedTab === 'apparatus' && <ApparatusPage />}
        </div>

        {/* Collapsible Proposals right panel */}
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
