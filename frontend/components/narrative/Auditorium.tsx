// [claude-code 2026-03-24] Thread selectedSymbol prop for TradingView chart, taller chart container (65vh)
// [claude-code 2026-03-24] Auditorium — 3-page dashboard (merged Risk + Narratives), expandable econ cards
import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import type { AuditoriumData, AuditoriumPreset, SimulationContext, RiskFlowCatalyst, AuditoriumNarrative } from '../../types/mirofish';
import { AUDITORIUM_PAGES, RISK_CATEGORY_LABELS, COMPOSITE_COLOR, ivHeatColor } from '../../types/mirofish';
import { AuditoriumChart } from './AuditoriumChart';
import { AuditoriumTheses } from './AuditoriumTheses';
import { AuditoriumEconIntel } from './AuditoriumEconIntel';
import { AuditoriumHeader } from './AuditoriumHeader';
import { AuditoriumMacroStrip } from './AuditoriumMacroStrip';
import { AuditoriumBriefing } from './AuditoriumBriefing';
import { AuditoriumNarratives } from './AuditoriumNarratives';
import { AuditoriumRiskAssessment } from './AuditoriumRiskAssessment';
import { CategoryScoreCard } from './CategoryScoreCard';
import { KanbanTitle } from '../ui/KanbanTitle';
import { AgentScorecard } from '../consilium/AgentScorecard';

interface CatalystInput {
  id: string;
  title: string;
  date: string;
  sentiment: string;
  severity: string;
  category?: string;
  narrativeIds?: string[];
}

interface AuditoriumProps {
  data: AuditoriumData | null;
  onRun: (preset?: AuditoriumPreset) => Promise<void>;
  catalysts: CatalystInput[];
  riskflowItems?: RiskFlowCatalyst[];
  macroContext?: SimulationContext | null;
  narratives?: AuditoriumNarrative[];
  selectedSymbol?: string;
}

type MiroFishRiskCategory = 'geopolitical' | 'political' | 'monetary-policy' | 'earnings-corporate' | 'market-structure' | 'black-swan';
const CATEGORIES: MiroFishRiskCategory[] = [
  'geopolitical', 'political', 'monetary-policy',
  'earnings-corporate', 'market-structure', 'black-swan',
];

export function Auditorium({ data, onRun, catalysts, riskflowItems, macroContext, narratives, selectedSymbol = '/MNQ' }: AuditoriumProps) {
  const [rollingDays, setRollingDays] = useState<7 | 14 | 30>(14);
  const [running, setRunning] = useState(false);
  const [preset, setPreset] = useState<AuditoriumPreset>(() => {
    try {
      const stored = localStorage.getItem('fintheon:auditorium-preset');
      return (stored as AuditoriumPreset) || 'full-brief';
    } catch { return 'full-brief'; }
  });
  const [activePage, setActivePage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const status = data?.status ?? 'idle';
  const isLoading = running || status === 'running';

  // Stable ref for onRun to avoid stale closure in mount effect
  const onRunRef = useRef(onRun);
  useLayoutEffect(() => { onRunRef.current = onRun; }, [onRun]);

  // Auto-run on mount if no data
  useEffect(() => {
    if (status !== 'idle' || running) return;
    let cancelled = false;
    fetch('/api/mirofish/auto-run-check')
      .then(r => r.json())
      .then(({ shouldRun }) => { if (!cancelled && shouldRun) onRunRef.current(preset); })
      .catch(() => { if (!cancelled) onRunRef.current(preset); });
    return () => { cancelled = true; };
  }, []); // Run once on mount — intentional empty deps

  const handleRun = useCallback(async (p?: AuditoriumPreset) => {
    if (running) return;
    setRunning(true);
    try { await onRun(p ?? preset); } finally { setRunning(false); }
  }, [onRun, preset, running]);

  const scrollToPage = useCallback((idx: number) => {
    setActivePage(idx);
    const el = containerRef.current;
    if (!el) return;
    const pages = el.querySelectorAll('[data-aud-page]');
    if (pages[idx]) pages[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handlePresetChange = useCallback((p: AuditoriumPreset) => {
    setPreset(p);
    try { localStorage.setItem('fintheon:auditorium-preset', p); } catch {}
    const focusPage = p === 'chart-focus' ? 0 : p === 'econ-watch' ? 1 : p === 'risk-scan' ? 2 : 0; // 3 pages: 0=Command, 1=Econ, 2=Risk&Narratives
    scrollToPage(focusPage);
    handleRun(p);
  }, [handleRun, scrollToPage]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const pages = el.querySelectorAll('[data-aud-page]');
    let closest = 0;
    let minDist = Infinity;
    pages.forEach((page, idx) => {
      const rect = page.getBoundingClientRect();
      const elTop = rect.top - el.getBoundingClientRect().top;
      const dist = Math.abs(elTop);
      if (dist < minDist) { minDist = dist; closest = idx; }
    });
    setActivePage(closest);
  }, []);

  // All pages always render — preset controls which page scrolls into focus
  const showPage = useCallback((_pageIdx: number) => true, []);

  const visiblePages = [0, 1, 2].filter(showPage);

  const displayContext = data?.contextSnapshot ?? macroContext ?? null;

  return (
    <div className="h-full w-full flex flex-col bg-[var(--fintheon-bg)]">
      {/* Persistent header — always visible */}
      <AuditoriumHeader
        preset={preset}
        onPresetChange={handlePresetChange}
        onRun={() => handleRun()}
        isLoading={isLoading}
        status={status}
        rollingDays={rollingDays}
        onRollingChange={setRollingDays}
      />

      <div className="flex flex-1 min-h-0">
        {/* Main scrollable area */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto scroll-smooth snap-y snap-mandatory"
        >
          {/* ── Page 0: Command Center ── */}
          {showPage(0) && (
            <div data-aud-page="0" className="min-h-full snap-start p-5 flex flex-col">
              {status === 'idle' && !isLoading && (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <Zap className="w-12 h-12 text-[var(--fintheon-accent)]/15 mb-4" />
                  <p className="text-sm text-[var(--fintheon-muted)]/40">Run MiroFish to generate predictions</p>
                  <p className="text-[10px] text-[var(--fintheon-muted)]/25 mt-1">5-agent debate simulation across 6 risk categories</p>
                </div>
              )}

              {isLoading && (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-[var(--fintheon-accent)] animate-spin mb-4" />
                  <p className="text-sm text-[var(--fintheon-muted)]/50">Agents debating...</p>
                  <p className="text-[10px] text-[var(--fintheon-muted)]/25 mt-1">Fetching VIX, FRED, RiskFlow context...</p>
                </div>
              )}

              {status === 'complete' && data && !isLoading && (
                <div className="flex-1 flex flex-col gap-4">
                  {/* Hero chart */}
                  <div className="shrink-0">
                    <div className="text-[10px] text-[var(--fintheon-text)]/60 mb-2 uppercase tracking-wider font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                      Price Projections
                    </div>
                    <div className="h-[65vh]">
                      <AuditoriumChart timeSeries={data.timeSeries} rollingDays={rollingDays} selectedSymbol={selectedSymbol} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                      {CATEGORIES.map(cat => {
                        const cs = data.categoryScores.find(s => s.category === cat);
                        return (
                          <div key={cat} className="flex items-center gap-1.5">
                            <div className="w-3 h-[2px]" style={{ backgroundColor: ivHeatColor(cs?.ivScore ?? 5) }} />
                            <span className="text-[9px] text-[var(--fintheon-muted)]/50">{RISK_CATEGORY_LABELS[cat]}</span>
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-[2px]" style={{ backgroundColor: COMPOSITE_COLOR }} />
                        <span className="text-[9px] text-[var(--fintheon-accent)]/70 font-bold">Composite</span>
                      </div>
                    </div>
                  </div>

                  {/* KPI Row: Core metrics — center justified */}
                  <div className="shrink-0 flex justify-center">
                    <div className="grid grid-cols-3 gap-4 w-full max-w-2xl">
                      <div className="rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)]/40 px-5 py-3 flex items-center justify-between" style={{ boxShadow: '0 0 12px rgba(212, 175, 55, 0.2)' }}>
                        <div>
                          <span className="text-[9px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">Composite IV</span>
                          <span className="text-3xl font-bold text-[var(--fintheon-accent)]">{data.compositeIV.toFixed(1)}</span>
                        </div>
                        <div className="w-10 h-10 rounded-full border-2 border-[var(--fintheon-accent)]/30 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-[var(--fintheon-accent)]" />
                        </div>
                      </div>
                      <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 px-5 py-3" style={{ boxShadow: '0 0 12px rgba(212, 175, 55, 0.2)' }}>
                        <span className="text-[9px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">Regime Shift</span>
                        <span className="text-2xl font-bold text-[var(--fintheon-text)]">{(data.regimeShiftProbability * 100).toFixed(0)}%</span>
                      </div>
                      <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 px-5 py-3" style={{ boxShadow: '0 0 12px rgba(212, 175, 55, 0.2)' }}>
                        <span className="text-[9px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">Model Confidence</span>
                        <span className="text-2xl font-bold text-[var(--fintheon-text)]">{(data.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Briefing */}
                  <AuditoriumBriefing briefing={data.briefing ?? null} isLoading={false} />
                </div>
              )}

              {status === 'error' && data?.error && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-[var(--fintheon-severe)]/70 text-center max-w-md">{data.error}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Page 1: Economic Intelligence ── */}
          {showPage(1) && (
            <div data-aud-page="1" className="min-h-full snap-start p-5 flex flex-col">
              <div className="shrink-0 mb-4">
                <KanbanTitle
                  title="Economic Intelligence"
                  tone="cyan"
                  tag="Econ Watch"
                  headerRight={
                    <span className="text-[9px] text-[var(--fintheon-muted)]/40">
                      Agent consensus on next prints
                    </span>
                  }
                />
              </div>
              <div className="flex-1">
                <AuditoriumEconIntel expanded={preset === 'econ-watch'} context={displayContext} categoryScores={data?.categoryScores} />
              </div>
            </div>
          )}

          {/* ── Page 2: Risk & Narratives (merged) ── */}
          {showPage(2) && (
            <div data-aud-page="2" className="min-h-full snap-start p-5 flex flex-col">
              <div className="shrink-0 mb-4">
                <KanbanTitle title="Risk & Narratives" tone="emerald" tag="Risk Scan" />
              </div>

              {status === 'complete' && data && !isLoading ? (
                <div className="flex-1 flex flex-col gap-6">
                  {/* Top Volatile Theses */}
                  <div>
                    <div className="text-[9px] text-[var(--fintheon-muted)]/40 mb-2 uppercase tracking-wider">
                      Top Volatile Theses
                    </div>
                    <AuditoriumTheses scenarios={data.scenarios} categoryScores={data.categoryScores} expanded={preset === 'risk-scan'} />
                  </div>

                  {/* Active Narratives */}
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-[var(--fintheon-border)]/10" />
                    <span className="text-[8px] text-[var(--fintheon-muted)]/30 uppercase tracking-widest">Narratives</span>
                    <div className="flex-1 h-px bg-[var(--fintheon-border)]/10" />
                  </div>
                  <AuditoriumNarratives narratives={narratives} expanded={preset === 'full-brief'} />

                  {/* ── Scorecards + Simulation History (split) ── */}
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-[var(--fintheon-border)]/10" />
                    <span className="text-[8px] text-[var(--fintheon-muted)]/30 uppercase tracking-widest">Performance</span>
                    <div className="flex-1 h-px bg-[var(--fintheon-border)]/10" />
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-[300px]">
                    {/* Agent Scorecards */}
                    <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/20 overflow-hidden">
                      <div className="px-4 py-2 border-b border-[var(--fintheon-border)]/10">
                        <span className="text-[9px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider">Agent Scorecards</span>
                      </div>
                      <div className="max-h-[350px] overflow-y-auto">
                        <AgentScorecard />
                      </div>
                    </div>
                    {/* Geopolitical & Fiscal Risk */}
                    <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/20 overflow-hidden">
                      <div className="px-4 py-2 border-b border-[var(--fintheon-border)]/10">
                        <span className="text-[9px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider">Geopolitical & Fiscal Risk</span>
                      </div>
                      <div className="p-3 max-h-[350px] overflow-y-auto">
                        {(riskflowItems?.length ?? 0) > 0 ? (
                          <AuditoriumRiskAssessment riskflowItems={riskflowItems ?? []} categoryScores={data.categoryScores} />
                        ) : (
                          <p className="text-[10px] text-[var(--fintheon-muted)]/30 text-center py-4">No risk signals in current window</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-[var(--fintheon-muted)]/30">Run MiroFish to populate risk data</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scroll-lock page indicators */}
        {visiblePages.length > 1 && (
          <div className="shrink-0 w-6 flex flex-col items-center justify-center gap-3 py-8">
            {visiblePages.map((pageIdx, i) => (
              <button
                key={pageIdx}
                onClick={() => scrollToPage(pageIdx)}
                aria-label={`Go to ${AUDITORIUM_PAGES[pageIdx]}`}
                aria-pressed={activePage === i}
                className="group relative flex items-center justify-center"
                title={AUDITORIUM_PAGES[pageIdx]}
              >
                <div
                  className={`transition-all duration-300 rounded-full ${
                    activePage === i
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
}
