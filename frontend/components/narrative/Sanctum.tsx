// [claude-code 2026-04-19] S25-T1: Removed KPI row (moved to Agent Desk fuses), stripped card borders to fading edges, viewport lock ≥1440px, fuses piped into DebatePanel
// [claude-code 2026-04-25] S38: Chart-mode pin-through — TradingView/SanctumChart is hoisted out of Page 0 into a persistent right-half panel, visible across every Sanctum page. Left half scrolls/snaps independently.
// [claude-code 2026-04-17] S23-T1: Aquarium restructure — top chart replaced with brief-pattern container (IV+Forecast | Deliberation), Chart toggle renders 50/50 with TradingView iframe, feels polish
// [claude-code 2026-04-16] Sanctum — full-border severity on Risk Signals containers, solvys-feels polish
// [claude-code 2026-03-28] S8-T4: Chart cleanup, Page 2 restructure (50/50 narratives+risk), sim history removed
// [claude-code 2026-03-28] S4-T3: KPI labels rewritten to trading lingo with interpretive sub-text
// [claude-code 2026-03-24] Persistence refactor: show persisted data immediately, background updates, no idle state
// [claude-code 2026-03-24] Thread selectedSymbol prop for TradingView chart, taller chart container (65vh)
// [claude-code 2026-03-24] Sanctum — 3-page dashboard (merged Risk + Narratives), expandable econ cards
import {
  useState,
  useCallback,
  useRef,
  useLayoutEffect,
  useEffect,
} from "react";
import { SolvysLoader } from "../shared/SolvysLoader";
import type {
  SanctumData,
  SanctumPreset,
  SimulationContext,
  RiskFlowCatalyst,
  SanctumNarrative,
} from "../../types/agent-desk";
import { AUDITORIUM_PAGES } from "../../types/agent-desk";
import { SanctumChart } from "./SanctumChart";
import { SanctumEconIntel } from "./SanctumEconIntel";
import { SanctumHeader } from "./SanctumHeader";
import { SanctumBriefing } from "./SanctumBriefing";
import { SanctumNarratives } from "./SanctumNarratives";
import { AquariumPredictionCards } from "./AquariumPredictionCards";
import { ConsolidatedTradeLedger } from "./ConsolidatedTradeLedger";
import { BlendedIVForecastCard } from "./BlendedIVForecastCard";
import { DayCard } from "./DayCard";
import { RiskSignalCards } from "./RiskSignalCards";
import { useIVScoreData } from "./useIVScoreData";
// [claude-code 2026-04-24] S35-T3: swap AgentDeskDebatePanel -> ArbitrumChamber
import { ArbitrumChamber } from "../arbitrum/ArbitrumChamber";

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
  /** Fires once per simulationId when AgentDesk deliberation completes — parent should reload latest report. */
  onSynthesisComplete?: () => void;
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

  // Auto-run check removed from mount — AgentDesk is scheduled twice daily
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
    if (pages[idx]) {
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      pages[idx].scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    }
  }, []);

  // Listen for cross-component navigation (right-rail Sanctum drawer dispatches this)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ page?: number }>).detail;
      if (typeof detail?.page === "number") scrollToPage(detail.page);
    };
    window.addEventListener("fintheon:aquarium-scroll-to", handler);
    return () =>
      window.removeEventListener("fintheon:aquarium-scroll-to", handler);
  }, [scrollToPage]);

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
    <div
      className="h-full w-full flex flex-col bg-[var(--fintheon-bg)]"
      data-aquarium-viewport-lock
    >
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
        {/* [claude-code 2026-04-25] S38: When chart mode is active, the TradingView chart
            is pinned to the right half of the viewport and stays visible across every
            page; the left half scrolls/pages independently. Off-mode falls back to the
            full-width single-scroll layout. */}
        {/* Main scrollable area */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className={`${chartMode ? "w-1/2" : "flex-1"} overflow-y-auto scroll-smooth snap-y snap-mandatory`}
        >
          {/* ── Page 0: Command Center ── */}
          {showPage(0) && (
            <div
              data-aud-page="0"
              className={`${chartMode ? "h-full" : "min-h-full"} snap-start p-3 pt-2 flex flex-col`}
            >
              {chartMode ? (
                /* [claude-code 2026-04-25] S38: Chart now lives in the persistent right-half
                   panel outside this scrollable area, so Page 0 in chart mode just renders the
                   compact left-column stack (briefing + IV cards + instrument cards). */
                <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
                  {data && data.compositeIV > 0 && (
                    <SanctumBriefing
                      briefing={data.briefing ?? null}
                      isLoading={false}
                      noBorder
                    />
                  )}
                  {/* [claude-code 2026-04-27] S46.4/K: combined IV+forecast card */}
                  <BlendedIVForecastCard data={ivData} isLoading={ivLoading} />
                  <AquariumPredictionCards />
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-4">
                  {/* Brief-pattern top container — Volatility Read left (55%), Deliberation right (45%) — no outer border, fading ruler divides */}
                  <div className="min-h-[520px] flex">
                    <div className="flex-1 flex overflow-hidden mx-1 my-1">
                      {/* Left: Volatility Read — Blended IV + Next Session Forecast (50%) */}
                      <div className="flex-1 min-w-0 overflow-y-auto p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--fintheon-accent)]"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            Volatility Read
                          </span>
                          {isLoading && (
                            <SolvysLoader size={12} />
                          )}
                        </div>
                        {/* [claude-code 2026-04-27] S46.4/K: combined IV+forecast card */}
                        <BlendedIVForecastCard
                          data={ivData}
                          isLoading={ivLoading}
                        />
                        <DayCard id="day-card-anchor" />
                      </div>

                      {/* Vertical ruler between Volatility Read and Deliberation */}
                      <div className="w-px shrink-0 bg-[var(--fintheon-accent)]/10" />

                      {/* Right: AgentDesk Deliberation with SIGNAL/REGIME/HEAT fuses at bottom (50%) */}
                      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                        <ArbitrumChamber
                          simulationId={data?.simulationId ?? null}
                          onSynthesisComplete={onSynthesisComplete}
                          compositeIV={data?.compositeIV}
                          regimeShiftProbability={data?.regimeShiftProbability}
                          confidence={data?.confidence}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Briefing */}
                  {data && data.compositeIV > 0 && (
                    <SanctumBriefing
                      briefing={data.briefing ?? null}
                      isLoading={false}
                      noBorder
                    />
                  )}

                  {/* Instrument Fuses — single fused row, /NQ /ES /YM /CL /GC with fading rulers */}
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
                  <button
                    onClick={() => handleRun()}
                    disabled={running}
                    className="mt-2 px-3 py-1 text-[10px] uppercase tracking-wider border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 disabled:opacity-40 transition-colors"
                  >
                    {running ? "Retrying..." : "Retry"}
                  </button>
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
                  {/* ── 2-col: Risk Signals (left, moved from bottom) | Active Narratives (right) ── */}
                  <div className="flex items-stretch min-h-[320px]">
                    {/* Left: Risk Signals */}
                    <div className="flex-1 min-w-0 flex flex-col px-3 py-2">
                      <div className="px-1 pb-2">
                        <span
                          className="text-[10px] tracking-[0.22em] uppercase text-[var(--fintheon-accent)]/85"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          Risk Signals
                        </span>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto">
                        <RiskSignalCards />
                      </div>
                    </div>

                    {/* Vertical ruler */}
                    <div className="w-px shrink-0 bg-[var(--fintheon-accent)]/10 mx-2" />

                    {/* Right: Active Narratives */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex-1 min-h-0 overflow-y-auto">
                        <SanctumNarratives
                          narratives={narratives}
                          expanded={preset === "full-brief"}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Horizontal ruler */}
                  <div className="h-px bg-[var(--fintheon-accent)]/10" />

                  {/* Consolidated Trade Ledger — replaces Polymarket kanban */}
                  <div>
                    <ConsolidatedTradeLedger />
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

        {/* [claude-code 2026-04-25] S38: Persistent right-half chart panel — pinned across
            every Sanctum page when chart mode is active, so the chart stays in view as the
            user scrolls/snaps through the left-half content. */}
        {chartMode && (
          <div className="w-1/2 shrink-0 border-l border-[var(--fintheon-accent)]/15 min-h-0 overflow-hidden">
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
        )}

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
                      : "w-[2px] h-5 bg-[var(--fintheon-text)]/20 hover:bg-[var(--fintheon-text)]/35"
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
