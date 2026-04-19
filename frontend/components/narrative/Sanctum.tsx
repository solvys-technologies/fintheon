// [claude-code 2026-04-17] S23-T1: Aquarium restructure — top chart replaced with brief-pattern container (IV+Forecast | Deliberation), Chart toggle renders 50/50 with TradingView iframe, feels polish
// [claude-code 2026-04-16] Sanctum — full-border severity on Risk Signals containers, solvys-feels polish
// [claude-code 2026-03-28] S8-T4: Chart cleanup, Page 2 restructure (50/50 narratives+risk), sim history removed
// [claude-code 2026-03-28] S4-T3: KPI labels rewritten to trading lingo with interpretive sub-text
// [claude-code 2026-03-24] Persistence refactor: show persisted data immediately, background updates, no idle state
// [claude-code 2026-03-24] Thread selectedSymbol prop for TradingView chart, taller chart container (65vh)
// [claude-code 2026-03-24] Sanctum — 3-page dashboard (merged Risk + Narratives), expandable econ cards
import { useState, useCallback, useRef, useLayoutEffect } from "react";
import { Loader2 } from "lucide-react";
import type {
  SanctumData,
  SanctumPreset,
  SimulationContext,
  RiskFlowCatalyst,
  SanctumNarrative,
} from "../../types/miroshark";
import { AUDITORIUM_PAGES, ivHeatColor } from "../../types/miroshark";
import { SanctumChart } from "./SanctumChart";
import { SanctumEconIntel } from "./SanctumEconIntel";
import { SanctumHeader } from "./SanctumHeader";
import { SanctumBriefing } from "./SanctumBriefing";
import { SanctumNarratives } from "./SanctumNarratives";
import { SanctumRiskAssessment } from "./SanctumRiskAssessment";
import { AgentScorecard } from "../consilium/AgentScorecard";
import { AquariumPredictionCards } from "./AquariumPredictionCards";
import { PolymarketPredictionCards } from "./PolymarketPredictionCards";
import { BlendedVIXCard } from "./BlendedVIXCard";
import { NextSessionForecastCard } from "./NextSessionForecastCard";
import { RiskSignalCards } from "./RiskSignalCards";
import { useIVScoreData } from "./useIVScoreData";
import { MiroSharkDebatePanel } from "../miroshark/MiroSharkDebatePanel";

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
  /** Chart mode — splits Aquarium 50/50 with a TradingView iframe on the right. Toggled from the Consilium tab bar Chart button. */
  chartMode?: boolean;
  /** Fires once per simulationId when MiroShark deliberation completes — parent should reload latest report. */
  onSynthesisComplete?: () => void;
}

function heatInterpretation(score: number): string {
  if (score >= 9) return "Extreme — capital preservation mode";
  if (score >= 7) return "High — reduce size, widen stops";
  if (score >= 5) return "Elevated — wider ranges, faster reversals";
  if (score >= 3) return "Moderate — normal conditions";
  return "Low — range-bound, fade extremes";
}

function regimeInterpretation(probability: number): string {
  const pct = probability * 100;
  if (pct >= 60) return "Likely shifting — trend models unreliable";
  if (pct >= 30) return "Possible — tighten stops on trend trades";
  if (pct >= 15) return "Low risk — current regime holding";
  return "Stable — no structural change expected";
}

function confidenceInterpretation(confidence: number): string {
  const pct = confidence * 100;
  if (pct >= 80) return "High conviction — size accordingly";
  if (pct >= 60) return "Moderate — standard positioning";
  if (pct >= 40) return "Uncertain — reduce exposure";
  return "Low — consider sitting out";
}

function KpiTile({
  label,
  value,
  valueColor,
  caption,
}: {
  label: string;
  value: string;
  valueColor: string;
  caption: string;
}) {
  return (
    <div className="rounded-md border border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-surface)] px-4 py-3">
      <span
        className="text-[8px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {label}
      </span>
      <span
        className="text-lg font-bold"
        style={{ color: valueColor, fontFamily: "var(--font-mono)" }}
      >
        {value}
      </span>
      <span className="text-[8px] text-[var(--fintheon-muted)]/40 block mt-0.5">
        {caption}
      </span>
    </div>
  );
}

function KpiRow({ data }: { data: SanctumData }) {
  return (
    <div className="shrink-0 flex justify-center">
      <div className="grid grid-cols-3 gap-3 w-full max-w-2xl">
        <KpiTile
          label="Market Heat"
          value={data.compositeIV.toFixed(1)}
          valueColor={ivHeatColor(data.compositeIV)}
          caption={heatInterpretation(data.compositeIV)}
        />
        <KpiTile
          label="Regime Risk"
          value={`${(data.regimeShiftProbability * 100).toFixed(0)}%`}
          valueColor={
            data.regimeShiftProbability >= 0.6
              ? "var(--fintheon-severe)"
              : data.regimeShiftProbability >= 0.3
                ? "var(--fintheon-neutral-severe)"
                : "var(--fintheon-low)"
          }
          caption={regimeInterpretation(data.regimeShiftProbability)}
        />
        <KpiTile
          label="Signal Strength"
          value={`${(data.confidence * 100).toFixed(0)}%`}
          valueColor={
            data.confidence >= 0.8
              ? "var(--fintheon-low)"
              : data.confidence >= 0.6
                ? "var(--fintheon-neutral-severe)"
                : "var(--fintheon-severe)"
          }
          caption={confidenceInterpretation(data.confidence)}
        />
      </div>
    </div>
  );
}

export function Sanctum({
  data,
  onRun,
  catalysts,
  riskflowItems,
  macroContext,
  narratives,
  selectedSymbol = "/MNQ",
  chartMode = false,
  onSynthesisComplete,
}: SanctumProps) {
  const { data: ivData, isLoading: ivLoading } = useIVScoreData();

  // Guardrailed 5-day rolling window — no user toggle
  const rollingDays = 5 as const;
  const [running, setRunning] = useState(false);
  const [preset, setPreset] = useState<SanctumPreset>(() => {
    try {
      const stored = localStorage.getItem("fintheon:auditorium-preset");
      return (stored as SanctumPreset) || "full-brief";
    } catch {
      return "full-brief";
    }
  });
  const [activePage, setActivePage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const status = data?.status ?? "idle";
  const isLoading = running || status === "running";

  // Stable ref for onRun to avoid stale closure in mount effect
  const onRunRef = useRef(onRun);
  useLayoutEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  // Auto-run check removed from mount — MiroShark is scheduled twice daily
  // (before MDB and ADB) via backend staleness threshold (6h).
  // Manual runs still available via the Simulate button in SanctumHeader.

  const handleRun = useCallback(
    async (p?: SanctumPreset) => {
      if (running) return;
      setRunning(true);
      try {
        await onRun(p ?? preset);
      } finally {
        setRunning(false);
      }
    },
    [onRun, preset, running],
  );

  const scrollToPage = useCallback((idx: number) => {
    setActivePage(idx);
    const el = containerRef.current;
    if (!el) return;
    const pages = el.querySelectorAll("[data-aud-page]");
    if (pages[idx])
      pages[idx].scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handlePresetChange = useCallback(
    (p: SanctumPreset) => {
      setPreset(p);
      try {
        localStorage.setItem("fintheon:auditorium-preset", p);
      } catch {}
      const focusPage =
        p === "chart-focus"
          ? 0
          : p === "econ-watch"
            ? 1
            : p === "risk-scan"
              ? 2
              : 0; // 3 pages: 0=Command, 1=Econ, 2=Risk&Narratives
      scrollToPage(focusPage);
      handleRun(p);
    },
    [handleRun, scrollToPage],
  );

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const pages = el.querySelectorAll("[data-aud-page]");
    let closest = 0;
    let minDist = Infinity;
    pages.forEach((page, idx) => {
      const rect = page.getBoundingClientRect();
      const elTop = rect.top - el.getBoundingClientRect().top;
      const dist = Math.abs(elTop);
      if (dist < minDist) {
        minDist = dist;
        closest = idx;
      }
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
            <div
              data-aud-page="0"
              className="min-h-full snap-start p-3 pt-2 flex flex-col"
            >
              {chartMode ? (
                /* Chart mode — 50/50 split: compact Aquarium stack on left, TradingView chart on right */
                <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-3 min-h-0">
                  <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                    {data && data.compositeIV > 0 && <KpiRow data={data} />}
                    {data && data.compositeIV > 0 && (
                      <SanctumBriefing
                        briefing={data.briefing ?? null}
                        isLoading={false}
                        noBorder
                      />
                    )}
                    <BlendedVIXCard data={ivData} isLoading={ivLoading} />
                    <NextSessionForecastCard
                      data={ivData}
                      isLoading={ivLoading}
                    />
                    <AquariumPredictionCards />
                  </div>
                  <div className="min-h-[60vh] xl:min-h-0 rounded-xl border border-[var(--fintheon-accent)]/12 overflow-hidden">
                    <SanctumChart
                      timeSeries={data?.timeSeries ?? []}
                      rollingDays={rollingDays}
                      selectedSymbol={selectedSymbol}
                      compositeIV={data?.compositeIV}
                      confidence={data?.confidence}
                      regimeShiftProbability={data?.regimeShiftProbability}
                      scenarios={data?.scenarios}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-4">
                  {/* Brief-pattern top container — IV+Forecast left (55%), Deliberation right (45%) */}
                  <div className="min-h-[520px] flex">
                    <div className="flex-1 flex border border-[var(--fintheon-accent)]/12 rounded-xl overflow-hidden mx-1 my-1">
                      {/* Left: Blended IV + Next Session Forecast (55%) */}
                      <div className="flex-[55] min-w-0 overflow-y-auto p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--fintheon-accent)]"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            Volatility Read
                          </span>
                          {isLoading && (
                            <Loader2 className="w-3 h-3 text-[var(--fintheon-accent)] animate-spin" />
                          )}
                        </div>
                        <BlendedVIXCard data={ivData} isLoading={ivLoading} />
                        <NextSessionForecastCard
                          data={ivData}
                          isLoading={ivLoading}
                        />
                      </div>

                      {/* Needle divider — matches Dashboard brief pattern */}
                      <div className="w-px relative shrink-0">
                        <div
                          className="absolute inset-0"
                          style={{
                            background:
                              "linear-gradient(to bottom, transparent 0%, var(--fintheon-accent) 25%, var(--fintheon-accent) 75%, transparent 100%)",
                            opacity: 0.15,
                          }}
                        />
                      </div>

                      {/* Right: MiroShark Deliberation (45%) */}
                      <div className="flex-[45] min-w-0 min-h-0 flex flex-col">
                        <MiroSharkDebatePanel
                          simulationId={data?.simulationId ?? null}
                          onSynthesisComplete={onSynthesisComplete}
                        />
                      </div>
                    </div>
                  </div>

                  {/* KPI Row */}
                  {data && data.compositeIV > 0 && (
                    <div className="shrink-0 flex justify-center">
                      <div className="grid grid-cols-3 gap-4 w-full max-w-2xl">
                        <KpiTile
                          label="Market Heat"
                          value={data.compositeIV.toFixed(1)}
                          valueColor={ivHeatColor(data.compositeIV)}
                          caption={heatInterpretation(data.compositeIV)}
                        />
                        <KpiTile
                          label="Regime Risk"
                          value={`${(data.regimeShiftProbability * 100).toFixed(0)}%`}
                          valueColor={
                            data.regimeShiftProbability >= 0.6
                              ? "var(--fintheon-severe)"
                              : data.regimeShiftProbability >= 0.3
                                ? "var(--fintheon-neutral-severe)"
                                : "var(--fintheon-low)"
                          }
                          caption={regimeInterpretation(
                            data.regimeShiftProbability,
                          )}
                        />
                        <KpiTile
                          label="Signal Strength"
                          value={`${(data.confidence * 100).toFixed(0)}%`}
                          valueColor={
                            data.confidence >= 0.8
                              ? "var(--fintheon-low)"
                              : data.confidence >= 0.6
                                ? "var(--fintheon-neutral-severe)"
                                : "var(--fintheon-severe)"
                          }
                          caption={confidenceInterpretation(data.confidence)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Briefing */}
                  {data && data.compositeIV > 0 && (
                    <SanctumBriefing
                      briefing={data.briefing ?? null}
                      isLoading={false}
                      noBorder
                    />
                  )}

                  {/* Prediction Cards — 5 instruments */}
                  <div className="flex justify-center">
                    <AquariumPredictionCards />
                  </div>
                </div>
              )}

              {status === "error" && data?.error && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-[var(--fintheon-severe)]/70 max-w-md mx-auto">
                    {data.error}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Page 1: Economic Intelligence ── */}
          {showPage(1) && (
            <div
              data-aud-page="1"
              className="min-h-full snap-start p-5 flex flex-col"
            >
              <div className="shrink-0 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-[11px] font-semibold text-[#67e8f9] tracking-[0.2em] uppercase">
                    Economic Intelligence
                  </h2>
                  <span className="text-[9px] tracking-[0.22em] uppercase text-[#67e8f9]/60">
                    Econ Watch
                  </span>
                </div>
                <span className="text-[9px] text-[var(--fintheon-muted)]/40">
                  Agent consensus on next prints
                </span>
              </div>
              <div className="flex-1">
                <SanctumEconIntel
                  expanded={preset === "econ-watch"}
                  context={displayContext}
                  categoryScores={data?.categoryScores}
                />
              </div>
            </div>
          )}

          {/* ── Page 2: Risk & Narratives (merged) ── */}
          {showPage(2) && (
            <div
              data-aud-page="2"
              className="min-h-full snap-start p-5 flex flex-col"
            >
              <div className="shrink-0 mb-4 flex items-center gap-2">
                <h2 className="text-[11px] font-semibold text-emerald-300 tracking-[0.2em] uppercase">
                  Risk & Narratives
                </h2>
                <span className="text-[9px] tracking-[0.22em] uppercase text-emerald-300/60">
                  Risk Scan
                </span>
              </div>

              {data && data.compositeIV > 0 ? (
                <div className="flex-1 flex flex-col gap-6">
                  {/* ── 50/50: Active Narratives + Live Risk Signals ── */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-[300px]">
                    {/* Left: Active Narratives */}
                    <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/20 overflow-hidden">
                      <div className="px-4 py-2 border-b border-[var(--fintheon-border)]/10">
                        <span className="text-[9px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider">
                          Active Narratives
                        </span>
                      </div>
                      <div className="p-3 max-h-[400px] overflow-y-auto">
                        <SanctumNarratives
                          narratives={narratives}
                          expanded={preset === "full-brief"}
                        />
                      </div>
                    </div>
                    {/* Right: Live Risk Signals */}
                    <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/20 overflow-hidden">
                      <div className="px-4 py-2 border-b border-[var(--fintheon-border)]/10">
                        <span className="text-[9px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider">
                          Live Risk Signals
                        </span>
                      </div>
                      <div className="p-3 max-h-[400px] overflow-y-auto">
                        {(riskflowItems?.length ?? 0) > 0 ? (
                          <SanctumRiskAssessment
                            riskflowItems={riskflowItems ?? []}
                            categoryScores={data.categoryScores}
                          />
                        ) : (
                          <p className="text-[10px] text-[var(--fintheon-muted)]/30 text-center py-4">
                            No risk signals in current window
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Prediction Markets & Polybot Trades — moved from Page 0 */}
                  <div>
                    <div className="text-[9px] text-[var(--fintheon-muted)]/40 mb-2 uppercase tracking-wider">
                      Prediction Markets & Polybot Trades
                    </div>
                    <PolymarketPredictionCards />
                  </div>

                  {/* ── Agent Scorecards ── */}
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-[var(--fintheon-border)]/10" />
                    <span className="text-[8px] text-[var(--fintheon-muted)]/30 uppercase tracking-widest">
                      Agent Performance
                    </span>
                    <div className="flex-1 h-px bg-[var(--fintheon-border)]/10" />
                  </div>
                  <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/20 overflow-hidden">
                    <div className="border-b border-[var(--fintheon-border)]/10">
                      <div className="px-4 py-2">
                        <span className="text-[9px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider">
                          Risk Signals
                        </span>
                      </div>
                      <div className="px-3 pb-3">
                        <RiskSignalCards />
                      </div>
                    </div>
                    <div className="max-h-[350px] overflow-y-auto">
                      <AgentScorecard />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-[var(--fintheon-muted)]/30">
                    Loading risk data...
                  </p>
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
                      ? "w-[3px] h-8 bg-[var(--fintheon-accent)]"
                      : "w-[2px] h-5 bg-gray-700 hover:bg-gray-500"
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
