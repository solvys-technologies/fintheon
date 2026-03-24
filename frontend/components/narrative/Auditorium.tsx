// [claude-code 2026-03-23] Auditorium — 4-page snap-scroll dashboard with persistent header + real data
import { useState, useCallback, useRef } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import type { AuditoriumData, AuditoriumPreset, SimulationContext, RiskFlowCatalyst, AuditoriumNarrative } from '../../types/mirofish';
import { AUDITORIUM_PAGES, RISK_CATEGORY_COLORS, RISK_CATEGORY_LABELS, COMPOSITE_COLOR } from '../../types/mirofish';
import { AuditoriumChart } from './AuditoriumChart';
import { AuditoriumKanban } from './AuditoriumKanban';
import { AuditoriumTheses } from './AuditoriumTheses';
import { AuditoriumEconIntel } from './AuditoriumEconIntel';
import { AuditoriumHeader } from './AuditoriumHeader';
import { AuditoriumMacroStrip } from './AuditoriumMacroStrip';
import { AuditoriumBriefing } from './AuditoriumBriefing';
import { AuditoriumNarratives } from './AuditoriumNarratives';
import { AuditoriumRiskAssessment } from './AuditoriumRiskAssessment';
import { KanbanTitle } from '../ui/KanbanTitle';

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
}

type MiroFishRiskCategory = 'geopolitical' | 'political' | 'monetary-policy' | 'earnings-corporate' | 'market-structure' | 'black-swan';
const CATEGORIES: MiroFishRiskCategory[] = [
  'geopolitical', 'political', 'monetary-policy',
  'earnings-corporate', 'market-structure', 'black-swan',
];

function CategoryScoreCard({ category, score, delta, confidence }: {
  category: MiroFishRiskCategory; score: number; delta: number; confidence: number;
}) {
  const color = RISK_CATEGORY_COLORS[category];
  const label = RISK_CATEGORY_LABELS[category];
  const deltaColor = delta > 0 ? '#EF4444' : delta < 0 ? '#34D399' : 'var(--fintheon-muted)';
  const deltaSign = delta > 0 ? '+' : '';
  const confPct = Math.round(confidence * 100);

  return (
    <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[10px] font-mono text-[var(--fintheon-text)]/80 uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-[10px] font-mono font-bold" style={{ color: deltaColor }}>
          {deltaSign}{delta.toFixed(1)}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-mono font-bold" style={{ color }}>{score.toFixed(1)}</span>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase">Conf</span>
          <div className="w-16 h-[3px] rounded-full bg-[var(--fintheon-border)]/10 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${confPct}%`,
                backgroundColor: confPct >= 70 ? '#34D399' : confPct >= 50 ? '#F59E0B' : '#EF4444',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Auditorium({ data, onRun, catalysts, riskflowItems, macroContext, narratives }: AuditoriumProps) {
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

  const handleRun = useCallback(async (p?: AuditoriumPreset) => {
    if (running) return;
    setRunning(true);
    try { await onRun(p ?? preset); } finally { setRunning(false); }
  }, [onRun, preset, running]);

  const handlePresetChange = useCallback((p: AuditoriumPreset) => {
    setPreset(p);
    try { localStorage.setItem('fintheon:auditorium-preset', p); } catch {}
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    // Auto-run simulation with new preset
    handleRun(p);
  }, [handleRun]);

  // Snap-scroll page detection
  const scrollToPage = useCallback((idx: number) => {
    setActivePage(idx);
    const el = containerRef.current;
    if (!el) return;
    const pages = el.querySelectorAll('[data-aud-page]');
    if (pages[idx]) pages[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

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

  // Determine which pages to show based on preset
  const showPage = useCallback((pageIdx: number) => {
    if (preset === 'full-brief') return true;
    if (preset === 'chart-focus') return pageIdx === 0;
    if (preset === 'econ-watch') return pageIdx === 0 || pageIdx === 1;
    if (preset === 'risk-scan') return pageIdx === 0 || pageIdx === 2;
    return true;
  }, [preset]);

  const visiblePages = [0, 1, 2, 3].filter(showPage);

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
                    <div className="text-[9px] text-[var(--fintheon-muted)]/40 font-mono mb-2 uppercase tracking-wider">
                      Predicted IV by Risk Type
                    </div>
                    <div className="h-[75vh]">
                      <AuditoriumChart timeSeries={data.timeSeries} rollingDays={rollingDays} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                      {CATEGORIES.map(cat => (
                        <div key={cat} className="flex items-center gap-1.5">
                          <div className="w-3 h-[2px]" style={{ backgroundColor: RISK_CATEGORY_COLORS[cat] }} />
                          <span className="text-[9px] text-[var(--fintheon-muted)]/50">{RISK_CATEGORY_LABELS[cat]}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-[2px]" style={{ backgroundColor: COMPOSITE_COLOR }} />
                        <span className="text-[9px] text-[var(--fintheon-accent)]/70 font-bold">Composite</span>
                      </div>
                    </div>
                  </div>

                  {/* KPI Row 1: Core metrics + Macro strip */}
                  <div className="shrink-0 flex flex-col gap-3">
                    <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
                      <div className="rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)]/40 px-5 py-3 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">Composite IV</span>
                          <span className="text-3xl font-mono font-bold text-[var(--fintheon-accent)]">{data.compositeIV.toFixed(1)}</span>
                        </div>
                        <div className="w-10 h-10 rounded-full border-2 border-[var(--fintheon-accent)]/30 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-[var(--fintheon-accent)]" />
                        </div>
                      </div>
                      <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 px-5 py-3">
                        <span className="text-[9px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">Regime Shift</span>
                        <span className="text-2xl font-mono font-bold text-[var(--fintheon-text)]">{(data.regimeShiftProbability * 100).toFixed(0)}%</span>
                      </div>
                      <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 px-5 py-3">
                        <span className="text-[9px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">Model Confidence</span>
                        <span className="text-2xl font-mono font-bold text-[var(--fintheon-text)]">{(data.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="hidden xl:flex items-center">
                        <AuditoriumMacroStrip context={displayContext} />
                      </div>
                    </div>
                    {/* Mobile macro strip */}
                    <div className="xl:hidden">
                      <AuditoriumMacroStrip context={displayContext} />
                    </div>
                  </div>

                  {/* KPI Row 2: Category score cards */}
                  <div className="shrink-0 grid grid-cols-3 xl:grid-cols-6 gap-3">
                    {data.categoryScores.map(cs => (
                      <CategoryScoreCard key={cs.category} category={cs.category} score={cs.ivScore} delta={cs.delta} confidence={cs.confidence} />
                    ))}
                  </div>

                  {/* Briefing */}
                  <AuditoriumBriefing briefing={data.briefing ?? null} isLoading={false} />
                </div>
              )}

              {status === 'error' && data?.error && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-[#EF4444]/70 text-center max-w-md">{data.error}</p>
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
                    <span className="text-[9px] font-mono text-[var(--fintheon-muted)]/40">
                      Agent consensus on next prints
                    </span>
                  }
                />
              </div>
              <div className="flex-1">
                <AuditoriumEconIntel expanded={preset === 'econ-watch'} context={displayContext} />
              </div>
            </div>
          )}

          {/* ── Page 2: Risk Sectors & Scenarios ── */}
          {showPage(2) && (
            <div data-aud-page="2" className="min-h-full snap-start p-5 flex flex-col">
              <div className="shrink-0 mb-4">
                <KanbanTitle title="Risk Sectors & Scenarios" tone="emerald" tag="Risk Scan" />
              </div>

              {status === 'complete' && data && !isLoading ? (
                <div className="flex-1 flex flex-col gap-6">
                  <div>
                    <div className="text-[9px] text-[var(--fintheon-muted)]/40 font-mono mb-2 uppercase tracking-wider">
                      Top Volatile Theses
                    </div>
                    <AuditoriumTheses scenarios={data.scenarios} categoryScores={data.categoryScores} expanded={preset === 'risk-scan'} />
                  </div>

                  <div>
                    <div className="text-[9px] text-[var(--fintheon-muted)]/40 font-mono mb-2 uppercase tracking-wider">
                      Upcoming Events by Risk Category
                    </div>
                    <AuditoriumKanban
                      catalysts={catalysts}
                      generatedEvents={data.generatedEvents}
                      riskflowItems={riskflowItems}
                      expanded={preset === 'risk-scan'}
                    />
                  </div>

                  {/* Geopolitical & Fiscal Risk */}
                  {(riskflowItems?.length ?? 0) > 0 && (
                    <div>
                      <div className="text-[9px] text-[var(--fintheon-muted)]/40 font-mono mb-2 uppercase tracking-wider">
                        Geopolitical & Fiscal Risk Assessment
                      </div>
                      <AuditoriumRiskAssessment riskflowItems={riskflowItems ?? []} categoryScores={data.categoryScores} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-[var(--fintheon-muted)]/30">Run MiroFish to populate risk data</p>
                </div>
              )}
            </div>
          )}

          {/* ── Page 3: Active Narratives & Large Moves ── */}
          {showPage(3) && (
            <div data-aud-page="3" className="min-h-full snap-start p-5 flex flex-col">
              <div className="shrink-0 mb-4">
                <KanbanTitle title="Active Narratives & Large Moves" tone="gold" tag="Narratives" />
              </div>
              <div className="flex-1">
                <AuditoriumNarratives narratives={narratives} expanded={preset === 'full-brief'} />
              </div>
            </div>
          )}
        </div>

        {/* Scroll-lock page indicators */}
        {visiblePages.length > 1 && (
          <div className="shrink-0 w-6 flex flex-col items-center justify-center gap-3 py-8">
            {visiblePages.map((pageIdx, i) => (
              <button
                key={pageIdx}
                onClick={() => scrollToPage(i)}
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
