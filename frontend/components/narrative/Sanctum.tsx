// [claude-code 2026-05-16] S68-T3: Added page 3 (Narrative Flow) with useThemes + NarrativeCanvas
// [claude-code 2026-05-16] S68-T4: Smooth page transitions with fade-in animation on page sections
// [claude-code 2026-05-11] S62-T1: Sanctum desktop layout audit — Solvys Gold page headers/tags (Page 1 & 2), vertical FadingRuler spacing parity, horizontal FadingRuler replaces solid divider, Page 0 non-chart padding to p-5.
// [claude-code 2026-04-29] S51: removed unused compositeIV/regimeShiftProbability/confidence props from ArbitrumChamber call (stale AgentDeskDebatePanel API)
// [claude-code 2026-04-19] S25-T1: Removed KPI row (moved to Agent Desk fuses), stripped card borders to fading edges, viewport lock ≥1440px, fuses piped into DebatePanel
// [claude-code 2026-04-25] S38: Chart-mode pin-through — TradingView/SanctumChart is hoisted out of Page 0 into a persistent right-half panel, visible across every Sanctum page. Left half scrolls/snaps independently.
// [claude-code 2026-04-17] S23-T1: ArbitrumChamber restructure — top chart replaced with brief-pattern container (IV+Forecast | Deliberation), Chart toggle renders 50/50 with TradingView iframe, feels polish
// [claude-code 2026-04-16] Sanctum — full-border severity on Risk Signals containers, solvys-feels polish
// [claude-code 2026-05-03] S57: Page 0 uses flex height and fading rulers, no chamber inner scroll.
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
import { FadingRuler } from "../shared/FadingRuler";
import type {
  SanctumData,
  SanctumPreset,
  SimulationContext,
  RiskFlowCatalyst,
  SanctumNarrative,
} from "../../types/agent-desk";
import { AUDITORIUM_PAGES } from "../../types/agent-desk";
import { SanctumEconIntel } from "./SanctumEconIntel";
import { SanctumHeader } from "./SanctumHeader";
import { SanctumBriefing } from "./SanctumBriefing";
import { SanctumNarratives } from "./SanctumNarratives";
import { ArbitrumChamberPredictionCards } from "./ArbitrumChamberPredictionCards";
import { ConsolidatedTradeLedger } from "./ConsolidatedTradeLedger";
import { BlendedIVForecastCard } from "./BlendedIVForecastCard";
import { DayCard } from "./DayCard";
import { RiskSignalCards } from "./RiskSignalCards";
import { useIVScoreData } from "./useIVScoreData";
// [claude-code 2026-04-24] S35-T3: swap AgentDeskDebatePanel -> ArbitrumChamber
// [claude-code 2026-05-01] S56 Track B: removed ArbitrumRiskSignals from Sanctum
//   (moved to Dashboard right rail, bottom slot now shows SanctumBriefing)
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
  onRun: (preset?: SanctumPreset, options?: SanctumRunOptions) => Promise<void>;
  catalysts: CatalystInput[];
  riskflowItems?: RiskFlowCatalyst[];
  macroContext?: SimulationContext | null;
  narratives?: SanctumNarrative[];
  selectedSymbol?: string;
  /** Chart mode — splits ArbitrumChamber 50/50 with a TradingView iframe on the right. Toggled from the Consilium tab bar Chart button. */
  chartMode?: boolean;
  /** Fires once per simulationId when AgentDesk deliberation completes — parent should reload latest report. */
  onSynthesisComplete?: () => void;
  /** Revision check status message shown under the briefing after refresh. */
  revisionStatus?: string | null;
  /** Whether a revision check is in progress. */
  revisionChecking?: boolean;
}

interface SanctumRunOptions {
  forceRun?: boolean;
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
  revisionStatus,
  revisionChecking,
}: SanctumProps) {
  const { data: ivData, isLoading: ivLoading } = useIVScoreData();
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
  const hasData = !!data && data.compositeIV > 0;
  const [hasPendingPresetRun, setHasPendingPresetRun] = useState(false);

  // Stable ref for onRun to avoid stale closure in mount effect
  const onRunRef = useRef(onRun);
  useLayoutEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  // Auto-run check removed from mount — AgentDesk is scheduled twice daily
  // (before MDB and ADB) via backend staleness threshold (6h).
  // Manual runs still available via the Simulate button in SanctumHeader.

  const handleRun = useCallback(
    async (p?: SanctumPreset, options?: SanctumRunOptions) => {
      if (running) return;
      setRunning(true);
      try {
        await onRun(p ?? preset, options);
        setHasPendingPresetRun(false);
      } finally {
        setRunning(false);
      }
    },
    [onRun, preset, running],
  );

  useEffect(() => {
    const handler = () => setHasPendingPresetRun(true);
    window.addEventListener("fintheon:arbitrum-run-presets-changed", handler);
    return () =>
      window.removeEventListener(
        "fintheon:arbitrum-run-presets-changed",
        handler,
      );
  }, []);

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
    window.addEventListener("fintheon:arbitrumChamber-scroll-to", handler);
    return () =>
      window.removeEventListener("fintheon:arbitrumChamber-scroll-to", handler);
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
      setHasPendingPresetRun(true);
    },
    [scrollToPage],
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
      data-arbitrum-chamber-viewport-lock
    >
      <style>{`
        @keyframes sanctum-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Persistent header — always visible */}
      <SanctumHeader
        preset={preset}
        onPresetChange={handlePresetChange}
        onRun={() =>
          handleRun(undefined, { forceRun: hasPendingPresetRun || !hasData })
        }
        isLoading={isLoading}
        status={status}
        hasData={hasData}
        hasPendingRun={hasPendingPresetRun}
      />

      <div className="flex flex-1 min-h-0">
        {/* [codex 2026-05-25] Chart mode now compacts this Arbitrum stack for the
            shared Consilium TradingView quick rail instead of mounting a local
            second iframe. */}
        {/* Main scrollable area */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 min-w-0 overflow-y-auto scroll-smooth snap-y snap-mandatory"
        >
          {/* ── Page 0: Command Center ── */}
          {showPage(0) && (
            <div
              data-aud-page="0"
              className={`${chartMode ? "h-full p-3 pt-2" : "min-h-full p-5"} snap-start flex flex-col`}
              style={{ animation: "sanctum-fade-in 0.35s ease-out" }}
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
                      revisionStatus={revisionStatus}
                      revisionChecking={revisionChecking}
                    />
                  )}
                  {/* [claude-code 2026-04-27] S46.4/K: combined IV+forecast card */}
                  <BlendedIVForecastCard data={ivData} isLoading={ivLoading} />
                  <ArbitrumChamberPredictionCards />
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col gap-4">
                  {/* Brief-pattern top container — Volatility Read + Arbitrum Chamber 50/50, ruler divides */}
                  <div className="flex-1 min-h-0 flex">
                    <div className="flex-1 min-h-0 flex mx-1 my-1">
                      {/* Left: Volatility Read — Blended IV + Next Session Forecast (50%) */}
                      <div className="flex-1 min-w-0 min-h-0 p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--fintheon-accent)]"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            Volatility Read
                          </span>
                          {isLoading && <SolvysLoader size={12} />}
                        </div>
                        {/* [claude-code 2026-04-27] S46.4/K: combined IV+forecast card */}
                        <BlendedIVForecastCard
                          data={ivData}
                          isLoading={ivLoading}
                        />
                        <DayCard id="day-card-anchor" bare />
                      </div>

                      {/* Vertical ruler between Volatility Read and Deliberation */}
                      <FadingRuler
                        orientation="vertical"
                        className="shrink-0"
                      />

                      {/* Right: Arbitrum Chamber (50%) */}
                      <div className="flex-1 min-w-0 min-h-0 p-4 flex flex-col">
                        <ArbitrumChamber
                          simulationId={data?.simulationId ?? null}
                          onSynthesisComplete={onSynthesisComplete}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Instrument Fuses — single fused row, /NQ /ES /YM /CL /GC with fading rulers */}
                  <div className="flex justify-center">
                    <ArbitrumChamberPredictionCards />
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
              style={{ animation: "sanctum-fade-in 0.35s ease-out" }}
            >
              <div className="shrink-0 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2
                    className="text-[11px] font-semibold text-[var(--fintheon-accent)]/85 tracking-[0.2em] uppercase"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Economic Intelligence
                  </h2>
                  <span className="text-[9px] tracking-[0.22em] uppercase text-[var(--fintheon-accent)]/60">
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
              style={{ animation: "sanctum-fade-in 0.35s ease-out" }}
            >
              <div className="shrink-0 mb-4 flex items-center gap-2">
                <h2
                  className="text-[11px] font-semibold text-[var(--fintheon-accent)]/85 tracking-[0.2em] uppercase"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Risk & Narratives
                </h2>
                <span className="text-[9px] tracking-[0.22em] uppercase text-[var(--fintheon-accent)]/60">
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
                    <FadingRuler orientation="vertical" className="shrink-0" />

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
                  <FadingRuler orientation="horizontal" />

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
