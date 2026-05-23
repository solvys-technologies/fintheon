// [claude-code 2026-04-17] S23-T1/T2: Debate button → Chart button (LineChart icon, toggles Sanctum 50/50 with TradingView), Proposals iframe-toggle removed, reloadLatestReport wired into AgentDesk synthesis-complete callback to fix ArbitrumChamber hang
// [claude-code 2026-04-03] Spring-physics CSS transitions for dropdowns, tab content, side panels
// [claude-code 2026-04-03] S14-T3: Consilium restructure — Boardroom + Apparatus as dropdowns
// [claude-code 2026-03-30] Wire narratives from NarrativeContext → Sanctum (ArbitrumChamber)
// [claude-code 2026-03-28] S7: Sanctum dropdown (NarrativeFlow/ArbitrumChamber/Timeline) inside Consilium tab bar
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  lazy,
  Suspense,
} from "react";
import {
  Users,
  Clock,
  Cpu,
  PanelRightOpen,
  PanelRightClose,
  ChevronDown,
  Zap,
  LineChart,
  Scroll,
  Plus,
} from "lucide-react";
import { useSettings } from "../../contexts/SettingsContext";
import { useConsiliumNav } from "../../lib/consilium-nav-store";
import { AgentChattr } from "./AgentChattr";
import { Sanctum } from "../narrative/Sanctum";
import { TimelinePanel } from "../narrative/TimelinePanel";
import { ProposalWidget } from "../proposals/ProposalWidget";
import { NarrativeCanvas } from "../narrative/NarrativeCanvas";
import {
  NarrativeProvider,
  useNarrative,
} from "../../contexts/NarrativeContext";
import { ApparatusFlowMap } from "../apparatus/ApparatusFlowMap";
import { ProxVoiceForum } from "../proxvoice/ProxVoiceForum";
import { AgentLounge } from "./AgentLounge";
import { EmbeddedBrowserFrame } from "../layout/EmbeddedBrowserFrame";
import { SoulFileroomPanel } from "../memory/SoulFileroomPanel";
import { AiLoader } from "../chat/FintheonThread";
import { useHarperOps } from "../../hooks/useHarperOps";
import { useThemes } from "../../hooks/useThemes";
import type {
  SanctumData,
  SanctumPreset,
  SimulationContext,
  RiskFlowCatalyst,
  SanctumNarrative,
} from "../../types/agent-desk";

import { ChatSidebar } from "../chat/ChatSidebar";
import { SessionsModal } from "../chat/SessionsModal";
import { HarperActivityFeed } from "./HarperActivityFeed";
import { SanctumSitemapDrawer } from "../layout/SanctumSitemapDrawer";
import {
  REGULAR_TABS,
  SANCTUM_SUB_VIEWS,
  BOARDROOM_SUB_VIEWS,
  APPARATUS_SUB_VIEWS,
} from "./ConsiliumTabConfig";
import type {
  ConsiliumTab,
  SanctumSubView,
  BoardroomSubView,
  ApparatusSubView,
} from "./ConsiliumTabConfig";
import { usePanelState } from "./usePanelState";
const ResearchBoard = lazy(() => import("../research/ResearchBoard"));

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

/** Bridge: reads NarrativeContext lanes → SanctumNarrative[] for Sanctum (ArbitrumChamber) */
function SanctumWithNarratives(
  props: Omit<React.ComponentProps<typeof Sanctum>, "narratives" | "catalysts">,
) {
  const { state, healthScores } = useNarrative();
  const narratives = useMemo<SanctumNarrative[]>(
    () =>
      state.lanes.map((lane) => ({
        id: lane.id,
        title: lane.title,
        category: lane.category,
        directionBias: lane.directionBias,
        healthScore: healthScores[lane.id] ?? lane.healthScore,
        instruments: lane.instruments,
        status: lane.status,
        dateRange: lane.dateRange,
      })),
    [state.lanes, healthScores],
  );
  const catalysts = useMemo(
    () =>
      state.catalysts.map((c) => ({
        id: c.id,
        title: c.title,
        date: c.date,
        sentiment: c.sentiment,
        severity: c.severity,
        category: c.category,
        narrativeIds: c.narrativeIds,
      })),
    [state.catalysts],
  );

  // Wrap onRun to inject real narrative state from NarrativeContext
  const { onRun, ...restProps } = props;
  const wrappedOnRun = useCallback(
    async (preset?: SanctumPreset) => {
      return (
        onRun as (
          preset?: SanctumPreset,
          narrativeState?: {
            lanes: typeof state.lanes;
            catalysts: typeof state.catalysts;
            ropes: typeof state.ropes;
          },
        ) => Promise<void>
      )(preset, {
        lanes: state.lanes,
        catalysts: state.catalysts,
        ropes: state.ropes,
      });
    },
    [onRun, state.lanes, state.catalysts, state.ropes],
  );

  return (
    <Sanctum
      {...restProps}
      onRun={wrappedOnRun}
      narratives={narratives}
      catalysts={catalysts}
    />
  );
}

export function ConsiliumHub() {
  const { selectedSymbol, iframeUrls } = useSettings();
  const { status: harperStatus } = useHarperOps();
  const { themes: flowThemes, isLoading: flowThemesLoading } = useThemes();
  const [activeTab, setActiveTab] = useState<ConsiliumTab>("chat");
  const [sanctumSubView, setSanctumSubView] =
    useState<SanctumSubView>("narratives");
  const [boardroomSubView, setBoardroomSubView] =
    useState<BoardroomSubView>("forum");
  const [apparatusSubView, setApparatusSubView] =
    useState<ApparatusSubView>("desk");
  const [displayedTab, setDisplayedTab] = useState<ConsiliumTab>("chat");
  const [displayedSubView, setDisplayedSubView] =
    useState<SanctumSubView>("narratives");
  const [displayedBoardroomSub, setDisplayedBoardroomSub] =
    useState<BoardroomSubView>("forum");
  const [displayedApparatusSub, setDisplayedApparatusSub] =
    useState<ApparatusSubView>("desk");
  const [sanctumDropdownOpen, setSanctumDropdownOpen] = useState(false);
  const [boardroomDropdownOpen, setBoardroomDropdownOpen] = useState(false);
  const [apparatusDropdownOpen, setApparatusDropdownOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [agentDeskData, setAgentDeskData] = useState<SanctumData | null>(null);
  const [riskflowItems, setRiskflowItems] = useState<RiskFlowCatalyst[]>([]);
  const [macroContext, setMacroContext] = useState<SimulationContext | null>(
    null,
  );
  type ActivePanel = "proposals" | "chart" | null;
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const showProposals = activePanel === "proposals";
  const showChart = activePanel === "chart";
  const toggleProposals = useCallback(
    () => setActivePanel((prev) => (prev === "proposals" ? null : "proposals")),
    [],
  );
  const toggleChart = useCallback(
    () => setActivePanel((prev) => (prev === "chart" ? null : "chart")),
    [],
  );
  const [showHarperFeed, setShowHarperFeed] = useState(true);
  const [showSessionsDropdown, setShowSessionsDropdown] = useState(false);
  const [boardroomDagRunning, setBoardroomDagRunning] = useState(false);
  const [revisionStatus, setRevisionStatus] = useState<string | null>(null);
  const [revisionChecking, setRevisionChecking] = useState(false);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for DAG running events dispatched from AgentChattr
  useEffect(() => {
    const handler = (e: Event) => {
      setBoardroomDagRunning(
        (e as CustomEvent<{ running: boolean }>).detail.running,
      );
    };
    window.addEventListener("fintheon:boardroom-dag-running", handler);
    return () =>
      window.removeEventListener("fintheon:boardroom-dag-running", handler);
  }, []);

  // Close dropdowns on outside click
  const sanctumDropdownRef = useRef<HTMLDivElement>(null);
  const boardroomDropdownRef = useRef<HTMLDivElement>(null);
  const apparatusDropdownRef = useRef<HTMLDivElement>(null);

  // [S23-T3] Persist current Consilium surface so useHermesChat can auto-inject ArbitrumChamber/surface
  // context into Harper + Hermes prompts without threading props through every chat widget.
  useEffect(() => {
    try {
      const surface =
        activeTab === "sanctum"
          ? sanctumSubView === "arbitrumChamber"
            ? "arbitrumChamber"
            : sanctumSubView === "narratives"
              ? "narratives"
              : "timeline"
          : activeTab === "boardroom"
            ? "boardroom"
            : activeTab === "apparatus"
              ? "apparatus"
              : "chat";
      localStorage.setItem("fintheon:current-surface", surface);
    } catch {}
  }, [activeTab, sanctumSubView]);

  useEffect(() => {
    const anyOpen =
      sanctumDropdownOpen || boardroomDropdownOpen || apparatusDropdownOpen;
    if (!anyOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        sanctumDropdownOpen &&
        sanctumDropdownRef.current &&
        !sanctumDropdownRef.current.contains(target)
      ) {
        setSanctumDropdownOpen(false);
      }
      if (
        boardroomDropdownOpen &&
        boardroomDropdownRef.current &&
        !boardroomDropdownRef.current.contains(target)
      ) {
        setBoardroomDropdownOpen(false);
      }
      if (
        apparatusDropdownOpen &&
        apparatusDropdownRef.current &&
        !apparatusDropdownRef.current.contains(target)
      ) {
        setApparatusDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sanctumDropdownOpen, boardroomDropdownOpen, apparatusDropdownOpen]);

  // Consume pending tab requests from external navigation (e.g. ChatPanel sidebar icons)
  const { pendingTab, clearPending } = useConsiliumNav();

  // Tab transition: fade out (150ms) → swap content → fade in (200ms)
  const handleTabChange = useCallback(
    (tab: ConsiliumTab) => {
      if (tab === activeTab && tab !== "sanctum") return;
      setTransitioning(true);
      setActiveTab(tab);
      if (transitionRef.current) clearTimeout(transitionRef.current);
      transitionRef.current = setTimeout(() => {
        setDisplayedTab(tab);
        setTransitioning(false);
      }, 150);
    },
    [activeTab],
  );

  const handleSanctumSubChange = useCallback(
    (sub: SanctumSubView) => {
      setSanctumSubView(sub);
      setSanctumDropdownOpen(false);
      if (activeTab !== "sanctum") {
        setActiveTab("sanctum");
      }
      setTransitioning(true);
      if (transitionRef.current) clearTimeout(transitionRef.current);
      transitionRef.current = setTimeout(() => {
        setDisplayedTab("sanctum");
        setDisplayedSubView(sub);
        setTransitioning(false);
      }, 150);
    },
    [activeTab],
  );

  const handleBoardroomSubChange = useCallback(
    (sub: BoardroomSubView) => {
      setBoardroomSubView(sub);
      setBoardroomDropdownOpen(false);
      if (activeTab !== "boardroom") {
        setActiveTab("boardroom");
      }
      setTransitioning(true);
      if (transitionRef.current) clearTimeout(transitionRef.current);
      transitionRef.current = setTimeout(() => {
        setDisplayedTab("boardroom");
        setDisplayedBoardroomSub(sub);
        setTransitioning(false);
      }, 150);
    },
    [activeTab],
  );

  const handleApparatusSubChange = useCallback(
    (sub: ApparatusSubView) => {
      setApparatusSubView(sub);
      setApparatusDropdownOpen(false);
      if (activeTab !== "apparatus") {
        setActiveTab("apparatus");
      }
      setTransitioning(true);
      if (transitionRef.current) clearTimeout(transitionRef.current);
      transitionRef.current = setTimeout(() => {
        setDisplayedTab("apparatus");
        setDisplayedApparatusSub(sub);
        setTransitioning(false);
      }, 150);
    },
    [activeTab],
  );

  // Consume pending tab from external navigation (ChatPanel sidebar icons)
  useEffect(() => {
    if (!pendingTab) return;
    clearPending();
    if (pendingTab === "chat") {
      handleTabChange("chat");
    } else if (pendingTab === "boardroom") {
      handleBoardroomSubChange("forum");
    } else if (pendingTab === "apparatus") {
      handleApparatusSubChange("desk");
    } else if (pendingTab === "sanctum") {
      handleSanctumSubChange("narratives");
    }
  }, [
    pendingTab,
    clearPending,
    handleTabChange,
    handleBoardroomSubChange,
    handleApparatusSubChange,
    handleSanctumSubChange,
  ]);

  useEffect(() => {
    return () => {
      if (transitionRef.current) clearTimeout(transitionRef.current);
    };
  }, []);

  // Fetch market context on mount
  const fetchContext = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agent-desk/context`);
      if (res.ok) {
        const ctx = await res.json();
        setMacroContext(ctx);
        if (ctx.riskflowHeadlines) setRiskflowItems(ctx.riskflowHeadlines);
      }
    } catch (err) {
      console.error("[ConsiliumHub] Context fetch failed:", err);
    }
  }, []);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  // [claude-code 2026-04-25] S35: load latest Arbitrum verdict on mount. The Sanctum
  // header reads `compositeIV` / `confidence` / `regimeShiftProbability` off
  // agentDeskData; we synthesize those from the verdict so "Update" actually drives
  // the chamber (was wired to the deprecated /api/agent-desk simulator that returns 500).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/arbitrum/latest`);
        if (!res.ok) return;
        const body = (await res.json()) as { verdict: any | null };
        const verdict = body?.verdict ?? null;
        if (!verdict || cancelled) return;
        setAgentDeskData({
          simulationId: verdict.id ?? verdict.verdict_id ?? "",
          status: "complete",
          compositeIV: Math.round((verdict.consensus_probability ?? 0) * 10),
          confidence: verdict.confidence ?? 0,
          regimeShiftProbability:
            verdict.iv_simulation?.regime_shift_probability ?? 0,
          categoryScores: [],
          timeSeries: [],
          generatedEvents: verdict.upcoming_catalysts ?? [],
          scenarios: [],
          briefing: verdict.digest_text
            ? ({ summary: verdict.digest_text } as any)
            : undefined,
          contextSnapshot: undefined,
        });
      } catch (err) {
        console.error("[ConsiliumHub] Arbitrum latest fetch failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyReport = useCallback(
    (report: Record<string, any>, simId?: string) => {
      setAgentDeskData({
        simulationId: simId ?? report.simulationId ?? "",
        status: "complete",
        compositeIV: report.compositeIV ?? report.nextSessionScore ?? 0,
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
    },
    [fetchContext],
  );

  // [claude-code 2026-04-25] S35: Update button now drives Arbitrum, not the deprecated
  // /api/agent-desk/simulate route (which has been returning 500 in prod for weeks since
  // MiroShark→Arbitrum cutover). On click: POST /api/arbitrum/deliberate with the current
  // narrative as context, then re-pull /api/arbitrum/latest for the verdict.
  const arbitrumVerdictToReport = useCallback(
    (verdict: any): Record<string, any> => ({
      simulationId: verdict?.id ?? verdict?.verdict_id ?? "",
      compositeIV: Math.round((verdict?.consensus_probability ?? 0) * 10),
      confidence: verdict?.confidence ?? 0,
      regimeShiftProbability:
        verdict?.iv_simulation?.regime_shift_probability ?? 0,
      categoryScores: [],
      timeSeries: [],
      generatedEvents: verdict?.upcoming_catalysts ?? [],
      scenarios: [],
      briefing: verdict?.digest_text
        ? ({ summary: verdict.digest_text } as any)
        : undefined,
      contextSnapshot: undefined,
    }),
    [],
  );

  const reloadLatestReport = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/arbitrum/latest`);
      if (!res.ok) return;
      const body = (await res.json()) as { verdict: any | null };
      const verdict = body?.verdict ?? null;
      if (verdict) applyReport(arbitrumVerdictToReport(verdict));
    } catch {
      // silent — next poll / trigger will retry
    }
  }, [applyReport, arbitrumVerdictToReport]);

  const handleRunAgentDesk = useCallback(
    async (
      preset?: SanctumPreset,
      narrativeState?: { lanes: any[]; catalysts: any[]; ropes: any[] },
    ) => {
      // Quick revision check first — scan recent RiskFlow items
      setRevisionChecking(true);
      setRevisionStatus(null);
      try {
        const revRes = await fetch(`${API_BASE}/api/arbitrum/revision-check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (revRes.ok) {
          const rev = (await revRes.json()) as {
            hasChanges: boolean;
            statusMessage: string;
            planUpdated?: boolean;
          };
          if (!rev.hasChanges) {
            setRevisionStatus(rev.statusMessage);
            setRevisionChecking(false);
            return;
          }
          // Notable items found — status message will show after deliberation
          setRevisionStatus(rev.statusMessage);
        }
      } catch {
        // Non-blocking — proceed with deliberation even if check fails
      } finally {
        setRevisionChecking(false);
      }

      setAgentDeskData((prev) =>
        prev
          ? { ...prev, status: "running" }
          : {
              simulationId: "",
              status: "running",
              compositeIV: 0,
              confidence: 0,
              regimeShiftProbability: 0,
              categoryScores: [],
              timeSeries: [],
              generatedEvents: [],
              scenarios: [],
            },
      );

      try {
        const presetQuestion =
          preset === "chart-focus"
            ? "Read the next session — chart focus"
            : preset === "econ-watch"
              ? "Read the next session — econ catalysts"
              : preset === "risk-scan"
                ? "Read the next session — risk scan"
                : "Read the next session — full brief";

        const ns = narrativeState ?? { lanes: [], catalysts: [], ropes: [] };
        const contextLines: string[] = [];
        if (ns.lanes?.length)
          contextLines.push(
            `Lanes: ${ns.lanes
              .map((l: any) => l?.label ?? l?.id ?? "")
              .filter(Boolean)
              .slice(0, 6)
              .join(", ")}`,
          );
        if (ns.catalysts?.length)
          contextLines.push(
            `Catalysts in play: ${ns.catalysts
              .map((c: any) => c?.headline ?? c?.title ?? "")
              .filter(Boolean)
              .slice(0, 6)
              .join(" | ")}`,
          );

        const delibRes = await fetch(`${API_BASE}/api/arbitrum/deliberate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: presetQuestion,
            category: "session-read",
            context:
              contextLines.length > 0 ? contextLines.join("\n") : undefined,
          }),
        });

        if (!delibRes.ok)
          throw new Error(`Chamber deliberate failed: ${delibRes.status}`);
        const delib = (await delibRes.json()) as {
          verdict_id?: string;
          consensus_probability?: number;
          confidence?: number;
          digest_text?: string;
        };

        // Pull the full verdict so seats/dissent/upcoming catalysts flow into
        // Sanctum surfaces (ArbitrumChamber reads from useArbitrumLatest separately).
        const latestRes = await fetch(`${API_BASE}/api/arbitrum/latest`);
        const latestBody = latestRes.ok
          ? ((await latestRes.json()) as { verdict: any | null })
          : null;
        const verdict = latestBody?.verdict ?? {
          id: delib.verdict_id,
          consensus_probability: delib.consensus_probability ?? 0,
          confidence: delib.confidence ?? 0,
          digest_text: delib.digest_text,
        };
        applyReport(arbitrumVerdictToReport(verdict), verdict.id);
      } catch (err) {
        console.error("[Arbitrum] Run failed:", err);
        setAgentDeskData((prev) =>
          prev
            ? {
                ...prev,
                status: "error",
                error: err instanceof Error ? err.message : "Unknown error",
              }
            : null,
        );
      }
    },
    [applyReport, arbitrumVerdictToReport],
  );

  const activeSanctumSub =
    SANCTUM_SUB_VIEWS.find((v) => v.id === sanctumSubView) ??
    SANCTUM_SUB_VIEWS[0];
  const SanctumIcon = activeSanctumSub.icon;

  return (
    <div className="flex h-full flex-col bg-[var(--fintheon-bg)]">
      {/* Tab bar: Sanctum dropdown + regular tabs + Proposals toggle */}
      <div className="flex items-center gap-0.5 px-4 pt-3 pb-1.5">
        <h2
          className="mr-3 text-sm font-medium uppercase tracking-[0.2em] text-[var(--fintheon-accent)]"
          style={{ fontFamily: "var(--font-heading, Roboto, sans-serif)" }}
        >
          Consilium
        </h2>

        {/* Chat button (direct) */}
        {REGULAR_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === id
                ? "text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30"
                : "border border-transparent text-[var(--fintheon-text)]/40 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]/70"
            }`}
            style={{ fontFamily: "var(--font-body, Roboto, sans-serif)" }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}

        {/* Sanctum tab with dropdown */}
        <div ref={sanctumDropdownRef} className="relative">
          <button
            onClick={() => setSanctumDropdownOpen((v) => !v)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "sanctum"
                ? "text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30"
                : "border border-transparent text-[var(--fintheon-text)]/40 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]/70"
            }`}
            style={{ fontFamily: "var(--font-body, Roboto, sans-serif)" }}
          >
            <Zap size={13} />
            Sanctum
            <ChevronDown
              size={10}
              className={`opacity-50 transition-transform ${sanctumDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          <div
            className="absolute top-full left-0 mt-1 z-50 min-w-[220px] overflow-hidden rounded-md border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)]"
            style={{
              opacity: sanctumDropdownOpen ? 1 : 0,
              transform: sanctumDropdownOpen
                ? "translateY(0) scale(1)"
                : "translateY(-4px) scale(0.97)",
              pointerEvents: sanctumDropdownOpen ? "auto" : "none",
              transition:
                "opacity 180ms var(--ease-spring), transform 180ms var(--ease-spring)",
            }}
          >
            {SANCTUM_SUB_VIEWS.map(
              ({ id, label, subtitle, icon: Icon }, idx) => (
                <button
                  key={id}
                  onClick={() => handleSanctumSubChange(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                    sanctumSubView === id && activeTab === "sanctum"
                      ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10"
                      : "text-[var(--fintheon-text)]/50 hover:text-[var(--fintheon-text)]/80 hover:bg-[var(--fintheon-accent)]/5"
                  }`}
                  style={{
                    opacity: sanctumDropdownOpen ? 1 : 0,
                    transform: sanctumDropdownOpen
                      ? "translateX(0)"
                      : "translateX(-6px)",
                    transition: `opacity 200ms var(--ease-spring) ${idx * 40}ms, transform 200ms var(--ease-spring) ${idx * 40}ms`,
                  }}
                >
                  <Icon size={13} className="shrink-0 mt-0.5" />
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{label}</span>
                    {subtitle && (
                      <span className="text-[10px] opacity-40 leading-tight">
                        {subtitle}
                      </span>
                    )}
                  </div>
                </button>
              ),
            )}
          </div>
        </div>

        {/* Imperium dropdown */}
        <div ref={boardroomDropdownRef} className="relative">
          <button
            onClick={() => setBoardroomDropdownOpen((v) => !v)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "boardroom"
                ? "text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30"
                : "border border-transparent text-[var(--fintheon-text)]/40 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]/70"
            }`}
            style={{ fontFamily: "var(--font-body, Roboto, sans-serif)" }}
          >
            <Users size={13} />
            Imperium
            {harperStatus?.loop?.alive && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
            {boardroomDagRunning && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-[var(--fintheon-accent)] animate-pulse"
                title="DAG deliberation in progress"
              />
            )}
            <ChevronDown
              size={10}
              className={`opacity-50 transition-transform ${boardroomDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          <div
            className="absolute top-full left-0 mt-1 z-50 min-w-[200px] overflow-hidden rounded-md border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)]"
            style={{
              opacity: boardroomDropdownOpen ? 1 : 0,
              transform: boardroomDropdownOpen
                ? "translateY(0) scale(1)"
                : "translateY(-4px) scale(0.97)",
              pointerEvents: boardroomDropdownOpen ? "auto" : "none",
              transition:
                "opacity 180ms var(--ease-spring), transform 180ms var(--ease-spring)",
            }}
          >
            {BOARDROOM_SUB_VIEWS.map(
              ({ id, label, subtitle, icon: Icon }, idx) => (
                <button
                  key={id}
                  onClick={() => handleBoardroomSubChange(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                    boardroomSubView === id && activeTab === "boardroom"
                      ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10"
                      : "text-[var(--fintheon-text)]/50 hover:text-[var(--fintheon-text)]/80 hover:bg-[var(--fintheon-accent)]/5"
                  }`}
                  style={{
                    opacity: boardroomDropdownOpen ? 1 : 0,
                    transform: boardroomDropdownOpen
                      ? "translateX(0)"
                      : "translateX(-6px)",
                    transition: `opacity 200ms var(--ease-spring) ${idx * 40}ms, transform 200ms var(--ease-spring) ${idx * 40}ms`,
                  }}
                >
                  <Icon size={13} className="shrink-0 mt-0.5" />
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{label}</span>
                    {subtitle && (
                      <span className="text-[10px] opacity-40 leading-tight">
                        {subtitle}
                      </span>
                    )}
                  </div>
                </button>
              ),
            )}
          </div>
        </div>

        {/* Apparatus dropdown */}
        <div ref={apparatusDropdownRef} className="relative">
          <button
            onClick={() => setApparatusDropdownOpen((v) => !v)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "apparatus"
                ? "text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30"
                : "border border-transparent text-[var(--fintheon-text)]/40 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]/70"
            }`}
            style={{ fontFamily: "var(--font-body, Roboto, sans-serif)" }}
          >
            <Cpu size={13} />
            Apparatus
            <ChevronDown
              size={10}
              className={`opacity-50 transition-transform ${apparatusDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          <div
            className="absolute top-full left-0 mt-1 z-50 min-w-[210px] overflow-hidden rounded-md border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)]"
            style={{
              opacity: apparatusDropdownOpen ? 1 : 0,
              transform: apparatusDropdownOpen
                ? "translateY(0) scale(1)"
                : "translateY(-4px) scale(0.97)",
              pointerEvents: apparatusDropdownOpen ? "auto" : "none",
              transition:
                "opacity 180ms var(--ease-spring), transform 180ms var(--ease-spring)",
            }}
          >
            {APPARATUS_SUB_VIEWS.map(
              ({ id, label, subtitle, icon: Icon }, idx) => (
                <button
                  key={id}
                  onClick={() => handleApparatusSubChange(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                    apparatusSubView === id && activeTab === "apparatus"
                      ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10"
                      : "text-[var(--fintheon-text)]/50 hover:text-[var(--fintheon-text)]/80 hover:bg-[var(--fintheon-accent)]/5"
                  }`}
                  style={{
                    opacity: apparatusDropdownOpen ? 1 : 0,
                    transform: apparatusDropdownOpen
                      ? "translateX(0)"
                      : "translateX(-6px)",
                    transition: `opacity 200ms var(--ease-spring) ${idx * 40}ms, transform 200ms var(--ease-spring) ${idx * 40}ms`,
                  }}
                >
                  <Icon size={13} className="shrink-0 mt-0.5" />
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{label}</span>
                    {subtitle && (
                      <span className="text-[10px] opacity-40 leading-tight">
                        {subtitle}
                      </span>
                    )}
                  </div>
                </button>
              ),
            )}
          </div>
        </div>

        <div className="flex-1" />

        {/* Right-justified chat tools — only when chat is active */}
        {activeTab === "chat" && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() =>
                window.dispatchEvent(new Event("fintheon:chat-run-report"))
              }
              className="p-1.5 text-zinc-500 hover:text-[#c79f4a] transition-colors"
              title="Run Report"
            >
              <Scroll className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() =>
                window.dispatchEvent(new Event("fintheon:chat-new"))
              }
              className="p-1.5 text-zinc-500 hover:text-[#c79f4a] transition-colors"
              title="New Chat"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowSessionsDropdown((v) => !v)}
                className="p-1.5 text-zinc-500 hover:text-[#c79f4a] transition-colors"
                title="History"
              >
                <Clock className="w-3.5 h-3.5" />
              </button>
              <SessionsModal
                isOpen={showSessionsDropdown}
                onClose={() => setShowSessionsDropdown(false)}
                onSelectSession={(id) => {
                  window.dispatchEvent(
                    new CustomEvent("fintheon:chat-load-session", {
                      detail: { id },
                    }),
                  );
                  setShowSessionsDropdown(false);
                }}
                onNewSession={() => {
                  window.dispatchEvent(new Event("fintheon:chat-new"));
                  setShowSessionsDropdown(false);
                }}
              />
            </div>
          </div>
        )}

        {activeTab === "sanctum" && (
          <div
            id="narrativeflow-header-actions"
            className={`flex items-center gap-1.5 ${
              sanctumSubView === "narratives" ? "" : "hidden"
            }`}
          />
        )}

        {activeTab === "sanctum" && (
          <div
            id="narrativeflow-map-controls"
            className={`flex items-center gap-1.5 ${
              sanctumSubView === "narratives" ? "" : "hidden"
            }`}
          />
        )}

        {activeTab === "sanctum" && (
          <button
            onClick={toggleChart}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              showChart
                ? "text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30"
                : "border border-transparent text-[var(--fintheon-accent)]/40 hover:text-[var(--fintheon-accent)]/70 hover:bg-[var(--fintheon-accent)]/5"
            }`}
            title={showChart ? "Hide Chart" : "Show Chart"}
          >
            <LineChart size={14} />
            Chart
          </button>
        )}

        <button
          onClick={toggleProposals}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            showProposals
              ? "text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30"
              : "border border-transparent text-[var(--fintheon-accent)]/40 hover:text-[var(--fintheon-accent)]/70 hover:bg-[var(--fintheon-accent)]/5"
          }`}
          title={showProposals ? "Hide Proposals" : "Show Proposals"}
        >
          {showProposals ? (
            <PanelRightClose size={14} />
          ) : (
            <PanelRightOpen size={14} />
          )}
          Proposals
        </button>
      </div>

      {/* Tab content + Proposals panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className="flex-1 min-h-0 min-w-0 overflow-hidden"
          style={{
            opacity: transitioning ? 0 : 1,
            transform: transitioning ? "translateY(6px)" : "translateY(0)",
            transition:
              "opacity 220ms var(--ease-spring), transform 220ms var(--ease-spring)",
          }}
        >
          {/* Sanctum sub-views — shared NarrativeProvider so seeds carry across views */}
          {displayedTab === "sanctum" && (
            <NarrativeProvider>
              {displayedSubView === "narratives" && (
                <NarrativeCanvas
                  themes={flowThemes}
                  isLoading={flowThemesLoading}
                  chartMode={showChart}
                />
              )}
              {displayedSubView === "arbitrumChamber" && (
                <SanctumWithNarratives
                  data={agentDeskData}
                  onRun={handleRunAgentDesk}
                  riskflowItems={riskflowItems}
                  macroContext={macroContext}
                  selectedSymbol={selectedSymbol.symbol}
                  chartMode={showChart}
                  onSynthesisComplete={reloadLatestReport}
                  revisionStatus={revisionStatus}
                  revisionChecking={revisionChecking}
                />
              )}
              {displayedSubView === "timeline" && <TimelinePanel />}
            </NarrativeProvider>
          )}

          {/* Chat — always mounted so streams survive tab switches */}
          <div
            className="h-full w-full"
            style={{ display: displayedTab === "chat" ? "block" : "none" }}
          >
            <ChatSidebar compact={false} />
          </div>

          {/* Imperium sub-views */}
          {displayedTab === "boardroom" && (
            <>
              {displayedBoardroomSub === "forum" && <ProxVoiceForum />}
              {displayedBoardroomSub === "agentic-chat" && (
                <div className="flex h-full">
                  <div className="flex-1 min-w-0">
                    <AgentChattr
                      headerSlot={
                        !showHarperFeed ? (
                          <button
                            onClick={() => setShowHarperFeed(true)}
                            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium text-[var(--fintheon-accent)]/50 border border-[var(--fintheon-accent)]/15 hover:text-[var(--fintheon-accent)] hover:border-[var(--fintheon-accent)]/30 transition-all"
                            title="Show Harper Activity"
                          >
                            <PanelRightOpen size={12} />
                            Activity
                          </button>
                        ) : undefined
                      }
                    />
                  </div>
                  {/* Harper Activity sidebar — matches Debate/Proposals collapsible pattern */}
                  <div
                    className={`flex-shrink-0 overflow-hidden border-l border-[var(--fintheon-accent)]/10 ${
                      showHarperFeed ? "w-80" : "w-0 border-l-0"
                    }`}
                    style={{
                      transition:
                        "width 280ms var(--ease-spring), border-width 280ms",
                    }}
                  >
                    <div
                      className="w-80 h-full overflow-hidden bg-[var(--fintheon-bg)]"
                      style={{
                        opacity: showHarperFeed ? 1 : 0,
                        transition: "opacity 200ms ease 80ms",
                      }}
                    >
                      <HarperActivityFeed
                        onCollapse={() => setShowHarperFeed(false)}
                      />
                    </div>
                  </div>
                </div>
              )}
              {displayedBoardroomSub === "research" && (
                <EmbeddedBrowserFrame
                  title="Research"
                  src={iframeUrls.research || ""}
                  className="w-full h-full"
                />
              )}
            </>
          )}

          {/* Apparatus sub-views */}
          {displayedTab === "apparatus" && (
            <>
              {displayedApparatusSub === "desk" && <ApparatusFlowMap />}
              {displayedApparatusSub === "fileroom" && <SoulFileroomPanel />}
              {displayedApparatusSub === "lounge" && <AgentLounge />}
            </>
          )}
        </div>

        {/* Collapsible Proposals + Scorecards right panel */}
        <div
          className={`flex-shrink-0 overflow-hidden border-l border-[var(--fintheon-accent)]/10 ${
            showProposals ? "w-80" : "w-0 border-l-0"
          }`}
          style={{
            transition: "width 280ms var(--ease-spring), border-width 280ms",
          }}
        >
          <div
            className="w-80 h-full flex flex-col bg-[var(--fintheon-bg)]"
            style={{
              opacity: showProposals ? 1 : 0,
              transition: "opacity 200ms ease 80ms",
            }}
          >
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ProposalWidget />
            </div>
          </div>
        </div>
      </div>

      {/* Right-rail Sanctum sitemap drawer — only when Sanctum is active */}
      {activeTab === "sanctum" && (
        <SanctumSitemapDrawer
          activeSubView={sanctumSubView}
          onNavigate={handleSanctumSubChange}
        />
      )}
    </div>
  );
}
