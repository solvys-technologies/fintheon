// [claude-code 2026-03-28] S8-T4: Chart cleanup, Page 2 restructure (50/50 narratives+risk), sim history removed
// [claude-code 2026-03-28] S4-T3: KPI labels rewritten to trading lingo with interpretive sub-text
// [claude-code 2026-03-24] Persistence refactor: show persisted data immediately, background updates, no idle state
// [claude-code 2026-03-24] Thread selectedSymbol prop for TradingView chart, taller chart container (65vh)
// [claude-code 2026-03-24] Sanctum — 3-page dashboard (merged Risk + Narratives), expandable econ cards
import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import type { SanctumData, SanctumPreset, SimulationContext, RiskFlowCatalyst, SanctumNarrative } from '../../types/miroshark';
import { AUDITORIUM_PAGES, ivHeatColor } from '../../types/miroshark';
import { SanctumChart } from './SanctumChart';
import { SanctumTheses } from './SanctumTheses';
import { SanctumEconIntel } from './SanctumEconIntel';
import { SanctumHeader } from './SanctumHeader';
import { SanctumMacroStrip } from './SanctumMacroStrip';
import { SanctumBriefing } from './SanctumBriefing';
import { SanctumNarratives } from './SanctumNarratives';
import { SanctumRiskAssessment } from './SanctumRiskAssessment';
import { AgentScorecard } from '../consilium/AgentScorecard';
import { AquariumPredictionCards } from './AquariumPredictionCards';

interface CatalystInput {
  id: string;
  title: string;
  date: string;
  sentiment: string;
  severity: string;
  category?: string;
  narrativeIds?: string[];
}

interface SanctumProps {
  data: SanctumData | null;
  onRun: (preset?: SanctumPreset) => Promise<void>;
  catalysts: CatalystInput[];
  riskflowItems?: RiskFlowCatalyst[];
  macroContext?: SimulationContext | null;
  narratives?: SanctumNarrative[];
  selectedSymbol?: string;
}

function heatInterpretation(score: number): string {
  if (score >= 9) return 'Extreme — capital preservation mode';
  if (score >= 7) return 'High — reduce size, widen stops';
  if (score >= 5) return 'Elevated — wider ranges, faster reversals';
  if (score >= 3) return 'Moderate — normal conditions';
  return 'Low — range-bound, fade extremes';
}

function regimeInterpretation(probability: number): string {
  const pct = probability * 100;
  if (pct >= 60) return 'Likely shifting — trend models unreliable';
  if (pct >= 30) return 'Possible — tighten stops on trend trades';
  if (pct >= 15) return 'Low risk — current regime holding';
  return 'Stable — no structural change expected';
}

function confidenceInterpretation(confidence: number): string {
  const pct = confidence * 100;
  if (pct >= 80) return 'High conviction — size accordingly';
  if (pct >= 60) return 'Moderate — standard positioning';
  if (pct >= 40) return 'Uncertain — reduce exposure';
  return 'Low — consider sitting out';
}


export function Sanctum({ data, onRun, catalysts, riskflowItems, macroContext, narratives, selectedSymbol = '/MNQ' }: SanctumProps) {
  // Guardrailed 5-day rolling window — no user toggle
  const rollingDays = 5 as const;
  const [running, setRunning] = useState(false);
  const [preset, setPreset] = useState<SanctumPreset>(() => {
    try {
      const stored = localStorage.getItem('fintheon:auditorium-preset');
      return (stored as SanctumPreset) || 'full-brief';
    } catch { return 'full-brief'; }
  });
  const [activePage, setActivePage] = useState(0);
  const [showProjection, setShowProjection] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const status = data?.status ?? 'idle';
  const isLoading = running || status === 'running';

  // Stable ref for onRun to avoid stale closure in mount effect
  const onRunRef = useRef(onRun);
  useLayoutEffect(() => { onRunRef.current = onRun; }, [onRun]);

  // Auto-run check removed from mount — MiroShark is scheduled twice daily
  // (before MDB and ADB) via backend staleness threshold (6h).
  // Manual runs still available via the Simulate button in SanctumHeader.

  const handleRun = useCallback(async (p?: SanctumPreset) => {
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

  const handlePresetChange = useCallback((p: SanctumPreset) => {
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
      <SanctumHeader
        preset={preset}
        onPresetChange={handlePresetChange}
        onRun={() => handleRun()}
        isLoading={isLoading}
        status={status}
        hasData={!!data && data.compositeIV > 0}
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
            <div data-aud-page="0" className="min-h-full snap-start p-3 pt-2 flex flex-col">
              <div className="flex-1 flex flex-col gap-4">
                {/* TradingView + Rolling IV bars — always visible */}
                <div className="shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[var(--fintheon-text)]/60 uppercase tracking-wider font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                        {selectedSymbol} — Rolling IV
                      </span>
                      {isLoading && (
                        <Loader2 className="w-3 h-3 text-[var(--fintheon-accent)] animate-spin" />
                      )}
                    </div>
                    {data && data.compositeIV > 0 && (
                      <button
                        onClick={() => setShowProjection(v => !v)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-medium transition-colors ${
                          showProjection
                            ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/8'
                            : 'text-[var(--fintheon-muted)]/50 hover:text-[var(--fintheon-text)]/70 hover:bg-[var(--fintheon-accent)]/5'
                        }`}
                        style={{ fontFamily: 'var(--font-body)' }}
                        title={showProjection ? 'Hide projection overlay' : 'Show projection overlay'}
                      >
                        {showProjection ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        Projection
                      </button>
                    )}
                  </div>
                  <div className="h-[58vh]">
                    <SanctumChart
                      timeSeries={data?.timeSeries ?? []}
                      rollingDays={rollingDays}
                      selectedSymbol={selectedSymbol}
                      compositeIV={showProjection && data ? data.compositeIV : undefined}
                      confidence={showProjection && data ? data.confidence : undefined}
                      regimeShiftProbability={showProjection && data ? data.regimeShiftProbability : undefined}
                      scenarios={showProjection && data ? data.scenarios : undefined}
                    />
                  </div>
                </div>

                {/* KPI Row — only when data exists */}
                {data && data.compositeIV > 0 && (
                  <div className="shrink-0 flex justify-center">
                    <div className="grid grid-cols-3 gap-4 w-full max-w-2xl">
                      <div className="rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)]/40 px-4 py-2 flex items-center justify-between" style={{ boxShadow: '0 0 12px rgba(212, 175, 55, 0.2)' }}>
                        <div>
                          <span className="text-[8px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">Market Heat</span>
                          <span className="text-xl font-bold" style={{ color: ivHeatColor(data.compositeIV) }}>{data.compositeIV.toFixed(1)}</span>
                          <span className="text-[8px] text-[var(--fintheon-muted)]/40 block mt-0.5">{heatInterpretation(data.compositeIV)}</span>
                        </div>
                        {/* Vertical shimmer fuse */}
                        <div
                          className="w-[3px] h-7 rounded-full overflow-hidden"
                          style={{
                            background: `linear-gradient(to top, ${ivHeatColor(data.compositeIV)}20, ${ivHeatColor(data.compositeIV)}, ${ivHeatColor(data.compositeIV)}20)`,
                            backgroundSize: '100% 200%',
                            animation: 'fuse-shimmer 2s ease-in-out infinite',
                          }}
                        />
                      </div>
                      <div className="rounded-lg border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 px-4 py-2" style={{ boxShadow: '0 0 12px rgba(212, 175, 55, 0.2)' }}>
                        <span className="text-[8px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">Regime Risk</span>
                        <span
                          className="text-lg font-bold"
                          style={{ color: data.regimeShiftProbability >= 0.6 ? 'var(--fintheon-severe)' : data.regimeShiftProbability >= 0.3 ? 'var(--fintheon-neutral-severe)' : 'var(--fintheon-low)' }}
                        >
                          {(data.regimeShiftProbability * 100).toFixed(0)}%
                        </span>
                        <span className="text-[8px] text-[var(--fintheon-muted)]/40 block mt-0.5">{regimeInterpretation(data.regimeShiftProbability)}</span>
                      </div>
                      <div className="rounded-lg border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 px-4 py-2" style={{ boxShadow: '0 0 12px rgba(212, 175, 55, 0.2)' }}>
                        <span className="text-[8px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">Signal Strength</span>
                        <span
                          className="text-lg font-bold"
                          style={{ color: data.confidence >= 0.8 ? 'var(--fintheon-low)' : data.confidence >= 0.6 ? 'var(--fintheon-neutral-severe)' : 'var(--fintheon-severe)' }}
                        >
                          {(data.confidence * 100).toFixed(0)}%
                        </span>
                        <span className="text-[8px] text-[var(--fintheon-muted)]/40 block mt-0.5">{confidenceInterpretation(data.confidence)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Analysis Briefing — below KPIs */}
                {data && data.compositeIV > 0 && (
                  <SanctumBriefing briefing={data.briefing ?? null} isLoading={false} noBorder />
                )}

                {/* Prediction Cards — 5 instruments */}
                <div className="flex justify-center">
                  <AquariumPredictionCards />
                </div>
              </div>

              {status === 'error' && data?.error && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-[var(--fintheon-severe)]/70 max-w-md mx-auto">{data.error}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Page 1: Economic Intelligence ── */}
          {showPage(1) && (
            <div data-aud-page="1" className="min-h-full snap-start p-5 flex flex-col">
              <div className="shrink-0 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-[11px] font-semibold text-[#67e8f9] tracking-[0.2em] uppercase">Economic Intelligence</h2>
                  <span className="text-[9px] tracking-[0.22em] uppercase text-[#67e8f9]/60">Econ Watch</span>
                </div>
                <span className="text-[9px] text-[var(--fintheon-muted)]/40">Agent consensus on next prints</span>
              </div>
              <div className="flex-1">
                <SanctumEconIntel expanded={preset === 'econ-watch'} context={displayContext} categoryScores={data?.categoryScores} />
              </div>
            </div>
          )}

          {/* ── Page 2: Risk & Narratives (merged) ── */}
          {showPage(2) && (
            <div data-aud-page="2" className="min-h-full snap-start p-5 flex flex-col">
              <div className="shrink-0 mb-4 flex items-center gap-2">
                <h2 className="text-[11px] font-semibold text-emerald-300 tracking-[0.2em] uppercase">Risk & Narratives</h2>
                <span className="text-[9px] tracking-[0.22em] uppercase text-emerald-300/60">Risk Scan</span>
              </div>

              {data && data.compositeIV > 0 ? (
                <div className="flex-1 flex flex-col gap-6">
                  {/* Top Volatile Theses */}
                  <div>
                    <div className="text-[9px] text-[var(--fintheon-muted)]/40 mb-2 uppercase tracking-wider">
                      Top Volatile Theses
                    </div>
                    <SanctumTheses scenarios={data.scenarios} categoryScores={data.categoryScores} expanded={preset === 'risk-scan'} />
                  </div>

                  {/* ── Bottom 50/50: Active Narratives + Live Risk Signals ── */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-[300px]">
                    {/* Left: Active Narratives */}
                    <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/20 overflow-hidden">
                      <div className="px-4 py-2 border-b border-[var(--fintheon-border)]/10">
                        <span className="text-[9px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider">Active Narratives</span>
                      </div>
                      <div className="p-3 max-h-[400px] overflow-y-auto">
                        <SanctumNarratives narratives={narratives} expanded={preset === 'full-brief'} />
                      </div>
                    </div>
                    {/* Right: Live Risk Signals */}
                    <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/20 overflow-hidden">
                      <div className="px-4 py-2 border-b border-[var(--fintheon-border)]/10">
                        <span className="text-[9px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider">Live Risk Signals</span>
                      </div>
                      <div className="p-3 max-h-[400px] overflow-y-auto">
                        {(riskflowItems?.length ?? 0) > 0 ? (
                          <SanctumRiskAssessment riskflowItems={riskflowItems ?? []} categoryScores={data.categoryScores} />
                        ) : (
                          <p className="text-[10px] text-[var(--fintheon-muted)]/30 text-center py-4">No risk signals in current window</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Agent Scorecards ── */}
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-[var(--fintheon-border)]/10" />
                    <span className="text-[8px] text-[var(--fintheon-muted)]/30 uppercase tracking-widest">Agent Performance</span>
                    <div className="flex-1 h-px bg-[var(--fintheon-border)]/10" />
                  </div>
                  <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/20 overflow-hidden">
                    <div className="max-h-[350px] overflow-y-auto">
                      <AgentScorecard />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-[var(--fintheon-muted)]/30">Loading risk data...</p>
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
