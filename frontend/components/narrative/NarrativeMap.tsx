// [claude-code 2026-05-16] S68-T4: Camera pan/zoom persistence, Reset View button, layout save/restore includes viewport
// [claude-code 2026-03-30] Added narrative visibility filter dropdown in top-right of canvas
// [claude-code 2026-03-30] Unified data: seed events + RiskFlow alerts both load into NarrativeContext
// [claude-code 2026-03-29] Catalysts sourced from DB via RiskFlowContext — seed JSON and localStorage import removed
// [claude-code 2026-03-28] S7: Force-directed canvas, removed Sanctum overlay (now separate view)
// [claude-code 2026-03-28] S5-T3: CatalystModal + auto-seed pipeline wired in
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useHarperOps } from "../../hooks/useHarperOps";
import { Eye, EyeOff, ChevronDown, Calendar } from "lucide-react";
import { useNarrative } from "../../contexts/NarrativeContext";
import NarrativeForceCanvas from "./NarrativeForceCanvas";
import { NarrativeSaveModal } from "./NarrativeSaveModal";
import { RiskFlowImportModal } from "./RiskFlowImportModal";
import { NarrativeTimelineModal } from "./NarrativeManageModal";
import { CatalystModal } from "./CatalystModal";
import { NarrativeHighlightProvider } from "./NarrativeHighlightProvider";
import {
  NarrativeFloatingToolbar,
  type CanvasTool,
} from "./NarrativeFloatingToolbar";
import { NarrativeCanvasChat } from "./NarrativeCanvasChat";
import { NarrativeColorKey } from "./NarrativeColorKey";
import type { NarrativeSessionSummary } from "./NarrativeSessionHistory";
import { useRiskFlow } from "../../contexts/RiskFlowContext";
import {
  loadSeedEvents,
  alertToCatalyst,
} from "../../lib/narrative-seed-loader";
import type { CatalystCard } from "../../lib/narrative-types";

const SESSION_MAP_POSITIONS = [
  { x: 18, y: 28 },
  { x: 42, y: 18 },
  { x: 66, y: 30 },
  { x: 30, y: 58 },
  { x: 56, y: 62 },
  { x: 78, y: 54 },
  { x: 48, y: 42 },
  { x: 22, y: 76 },
];

export function NarrativeMap({
  sessions,
  activeSessionId,
  onOpenSession,
}: {
  sessions?: NarrativeSessionSummary[];
  activeSessionId?: string | null;
  onOpenSession?: (id: string) => void;
}) {
  const { state, snapshot, dispatch } = useNarrative();
  // [claude-code 2026-04-05] Harper presence overlay
  const { status: harperStatus, feed: harperFeed } = useHarperOps();
  const [goldFlash, setGoldFlash] = useState(false);
  const lastSynthesisRef = useRef<string | null>(null);
  useEffect(() => {
    const latest = harperFeed[0];
    if (!latest || latest.id === lastSynthesisRef.current) return;
    if (
      (latest.metadata as Record<string, unknown>)?.taskType ===
      "narrative-synthesis"
    ) {
      lastSynthesisRef.current = latest.id;
      setGoldFlash(true);
      const t = setTimeout(() => setGoldFlash(false), 3000);
      return () => clearTimeout(t);
    }
  }, [harperFeed]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  // Empty set = show all narratives (canvas checks size === 0 → show all)
  const [visibleLaneIds, setVisibleLaneIds] = useState<Set<string>>(new Set());
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [catalystModalOpen, setCatalystModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CatalystCard | null>(null);
  const [canvasTool, setCanvasTool] = useState<CanvasTool>("select");
  const [canvasScale, setCanvasScale] = useState(1.0);
  const [timeframeFilter, setTimeframeFilter] = useState<string>("all");
  const [headerMapControlsHost, setHeaderMapControlsHost] =
    useState<HTMLElement | null>(null);
  const [zoomFns, setZoomFns] = useState<{
    zoomTo: (level: number) => void;
    fitView: () => void;
    resetView: () => void;
    setViewport: (vp: { x: number; y: number; zoom: number }) => void;
  } | null>(null);
  const { alerts } = useRiskFlow();
  const seedLoadedRef = useRef(false);
  const workspaceSessions = useMemo(
    () => (sessions ?? []).filter((session) => session.id && session.title),
    [sessions],
  );
  const isWorkspaceScoped = Array.isArray(sessions);

  useEffect(() => {
    const syncHeaderHost = () => {
      setHeaderMapControlsHost(document.getElementById("narrativeflow-map-controls"));
    };
    syncHeaderHost();
    const frame = requestAnimationFrame(syncHeaderHost);
    return () => cancelAnimationFrame(frame);
  }, [isWorkspaceScoped]);

  // Load historical seed events on first boot (513 pre-classified catalysts)
  useEffect(() => {
    if (isWorkspaceScoped) return;
    if (seedLoadedRef.current) return;
    seedLoadedRef.current = true;
    const seedCards = loadSeedEvents();
    if (seedCards.length > 0) {
      dispatch({ type: "BULK_ADD_CATALYSTS", catalysts: seedCards });
    }
  }, [dispatch, isWorkspaceScoped]);

  // Sync promoted RiskFlow items as catalyst cards (DB-backed, not localStorage seeds)
  useEffect(() => {
    if (isWorkspaceScoped) return;
    if (alerts.length === 0) return;
    const existingRfIds = new Set(
      state.catalysts
        .filter((c) => c.riskflowItemId)
        .map((c) => c.riskflowItemId!),
    );
    const promoted = alerts
      .filter(
        (a) =>
          a.promotedAt || (a.narrativeThreads && a.narrativeThreads.length > 0),
      )
      .filter((a) => !existingRfIds.has(a.id))
      .map(alertToCatalyst);
    if (promoted.length > 0) {
      dispatch({ type: "BULK_ADD_CATALYSTS", catalysts: promoted });
    }
  }, [alerts, state.catalysts, dispatch, isWorkspaceScoped]);

  const handleSave = useCallback(() => {
    setSaveModalOpen(true);
  }, []);

  const handleConfirmSave = useCallback(() => {
    dispatch({ type: "TAKE_SNAPSHOT" });
    setSaveModalOpen(false);
  }, [dispatch]);

  const handleImportCatalysts = useCallback(
    (catalysts: any[]) => {
      dispatch({ type: "IMPORT_CATALYSTS", catalysts });
    },
    [dispatch],
  );

  const handleUndo = useCallback(() => {
    if (snapshot) {
      dispatch({ type: "RESTORE_SNAPSHOT" });
    }
  }, [snapshot, dispatch]);

  const handleToggleLane = useCallback((id: string) => {
    setVisibleLaneIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setVisibleLaneIds(new Set(state.lanes.map((l) => l.id)));
  }, [state.lanes]);

  const handleClearAll = useCallback(() => {
    setVisibleLaneIds(new Set());
  }, []);

  const handleToggleTag = useCallback((tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }, []);

  const LAYOUT_KEY = "fintheon:narrative-map-layout";

  const handleSaveLayout = useCallback(() => {
    const layout = {
      visibleLaneIds: Array.from(visibleLaneIds),
      activeTags: Array.from(activeTags),
      canvasScale,
    };
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    } catch {
      // silent
    }
  }, [visibleLaneIds, activeTags, canvasScale]);

  const handleResetLayout = useCallback(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (!raw) return;
      const layout = JSON.parse(raw);
      if (layout.visibleLaneIds)
        setVisibleLaneIds(new Set(layout.visibleLaneIds));
      if (layout.activeTags) setActiveTags(new Set(layout.activeTags));
      if (layout.canvasScale != null) setCanvasScale(layout.canvasScale);
    } catch {
      // silent
    }
  }, []);

  const handleResetView = useCallback(() => {
    zoomFns?.resetView();
  }, [zoomFns]);

  // Auto-save layout on navigate away (visibility change)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") handleSaveLayout();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [handleSaveLayout]);

  // Restore layout on mount
  useEffect(() => {
    handleResetLayout();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectCard = useCallback((_id: string) => {
    // Selection is visual-only, handled inside the force canvas
  }, []);

  const handleEditCard = useCallback((card: CatalystCard) => {
    setEditingCard(card);
    setCatalystModalOpen(true);
  }, []);
  const mapFilterControls = !isWorkspaceScoped ? (
    <>
      <TimeframeFilterDropdown
        selected={timeframeFilter}
        onSelect={setTimeframeFilter}
      />
      <NarrativeFilterDropdown
        visibleLaneIds={visibleLaneIds}
        onToggleLane={handleToggleLane}
        onSelectAll={handleSelectAll}
        onClearAll={handleClearAll}
        catalysts={state.catalysts}
      />
    </>
  ) : null;

  return (
    <NarrativeHighlightProvider>
      <div
        className="h-full flex flex-col"
        style={{ backgroundColor: "var(--fintheon-bg)" }}
      >
        {headerMapControlsHost && mapFilterControls
          ? createPortal(mapFilterControls, headerMapControlsHost)
          : null}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          {/* Force-directed mind map canvas */}
          {isWorkspaceScoped ? (
            <WorkspaceNarrativesMap
              sessions={workspaceSessions}
              activeSessionId={activeSessionId ?? null}
              onOpenSession={onOpenSession}
            />
          ) : (
            <NarrativeForceCanvas
              visibleLaneIds={visibleLaneIds}
              activeTags={activeTags}
              activeTool={canvasTool}
              timeframeFilter={timeframeFilter}
              onScaleChange={setCanvasScale}
              onSelectCard={handleSelectCard}
              onEditCard={handleEditCard}
              onZoomFnsReady={setZoomFns}
            />
          )}

          {/* Narrative color key — bottom-right */}
          {!isWorkspaceScoped ? <NarrativeColorKey /> : null}

          {/* Harper watching overlay — bottom-left */}
          {harperStatus?.loop?.alive && (
            <div className="absolute bottom-3 left-3 z-40 pointer-events-none flex items-center gap-1.5 px-2.5 py-1">
              <span
                className={`h-1.5 w-1.5 rounded-full ${goldFlash ? "bg-[#D4AF37]" : "bg-emerald-400"} animate-pulse`}
              />
              <span className="text-[10px] tracking-wider text-[#f0ead6]/40 font-mono">
                {goldFlash ? "FRESH SYNTHESIS" : "HARPER WATCHING"}
              </span>
            </div>
          )}

          {/* Map controls — one top-right row */}
          {!headerMapControlsHost && mapFilterControls ? (
            <div className="absolute right-3 top-3 z-40 flex items-center gap-1.5">
              {mapFilterControls}
            </div>
          ) : null}

          {/* Canvas command palette — ephemeral chat above toolbar */}
          {!isWorkspaceScoped ? <NarrativeCanvasChat /> : null}

          {/* Figma-style floating toolbar — bottom center */}
          {!isWorkspaceScoped ? (
            <NarrativeFloatingToolbar
              activeTool={canvasTool}
              onToolChange={setCanvasTool}
              onAddCatalyst={() => {
                setCatalystModalOpen(true);
                setEditingCard(null);
              }}
              onImport={() => setImportModalOpen(true)}
              onToggleSanctum={(_page?: number) => {
                /* TODO: wire to Sanctum sub-view navigation — requires props from MainLayout */
              }}
              onToggleHeatmap={() => dispatch({ type: "TOGGLE_HEATMAP" })}
              onToggleFilter={() => {
                const next =
                  state.filterSentiment === "all"
                    ? "bearish"
                    : state.filterSentiment === "bearish"
                      ? "bullish"
                      : "all";
                dispatch({ type: "SET_FILTER", sentiment: next });
              }}
              sanctumActive={false}
              heatmapActive={state.heatmapEnabled}
              filterActive={state.filterSentiment !== "all"}
              scale={canvasScale}
              onZoomTo={zoomFns?.zoomTo}
              onFitView={zoomFns?.fitView}
              onResetView={handleResetView}
            />
          ) : null}
        </div>

        <NarrativeSaveModal
          open={saveModalOpen}
          onConfirm={handleConfirmSave}
          onCancel={() => setSaveModalOpen(false)}
        />

        <RiskFlowImportModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={handleImportCatalysts}
          lanes={state.lanes}
        />

        <NarrativeTimelineModal
          open={manageModalOpen}
          onClose={() => setManageModalOpen(false)}
        />

        <CatalystModal
          open={catalystModalOpen}
          onClose={() => {
            setCatalystModalOpen(false);
            setEditingCard(null);
          }}
          editCard={editingCard}
        />
      </div>
    </NarrativeHighlightProvider>
  );
}

function WorkspaceNarrativesMap({
  sessions,
  activeSessionId,
  onOpenSession,
}: {
  sessions: NarrativeSessionSummary[];
  activeSessionId: string | null;
  onOpenSession?: (id: string) => void;
}) {
  if (sessions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]">
            No narratives built
          </p>
          <p className="mt-2 max-w-sm text-xs leading-5 text-[var(--fintheon-muted)]">
            Build a NarrativeFlow workspace and it will appear here as a bounded
            narrative territory.
          </p>
        </div>
      </div>
    );
  }

  const links = sessions.flatMap((session, index) =>
    sessions.slice(index + 1).map((next, offset) => ({
      id: `${session.id}-${next.id}`,
      from: SESSION_MAP_POSITIONS[index % SESSION_MAP_POSITIONS.length],
      to: SESSION_MAP_POSITIONS[(index + offset + 1) % SESSION_MAP_POSITIONS.length],
    })),
  );

  return (
    <div className="relative h-full overflow-hidden">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-35"
        preserveAspectRatio="none"
      >
        {links.map((link) => (
          <line
            key={link.id}
            x1={`${link.from.x}%`}
            y1={`${link.from.y}%`}
            x2={`${link.to.x}%`}
            y2={`${link.to.y}%`}
            stroke="rgba(20,184,166,0.28)"
            strokeDasharray="3 6"
            strokeWidth="1"
          />
        ))}
      </svg>
      {sessions.map((session, index) => {
        const point = SESSION_MAP_POSITIONS[index % SESSION_MAP_POSITIONS.length];
        const isActive = session.id === activeSessionId;
        const size = Math.max(120, Math.min(230, 116 + session.catalystCount * 2));
        return (
          <button
            key={session.id}
            type="button"
            onClick={() => onOpenSession?.(session.id)}
            className="group absolute -translate-x-1/2 -translate-y-1/2 text-left transition duration-200 hover:scale-[1.02]"
            style={{ left: `${point.x}%`, top: `${point.y}%`, width: size }}
          >
            <span
              aria-hidden="true"
              className={`absolute left-1/2 top-1/2 rounded-full transition duration-200 ${
                isActive ? "opacity-30" : "opacity-12 group-hover:opacity-20"
              }`}
              style={{
                width: size,
                height: size,
                transform: "translate(-50%, -50%)",
                background: `radial-gradient(circle, ${session.color}26 0%, ${session.color}0d 58%, transparent 70%)`,
              }}
            />
            <span
              className={`relative block max-w-[220px] text-[12px] font-semibold leading-4 ${
                isActive
                  ? "text-[var(--fintheon-accent)]"
                  : "text-[var(--fintheon-text)]/80 group-hover:text-[var(--fintheon-accent)]"
              }`}
              style={{ textShadow: "0 0 16px rgba(0,0,0,0.9)" }}
            >
              {session.title}
            </span>
            <span className="relative mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]/55">
              {session.catalystCount} catalysts · {session.deskLabel ?? "Workspace"}
            </span>
          </button>
        );
      })}
      <div className="absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]/55">
        {sessions.length} built narratives
      </div>
    </div>
  );
}

// ── Timeframe Filter Dropdown ────────────────────────────────────
const TIMEFRAME_OPTIONS = [
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
  { value: "2w", label: "2W" },
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
] as const;

function TimeframeFilterDropdown({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isFiltered = selected !== "all";
  const label =
    TIMEFRAME_OPTIONS.find((o) => o.value === selected)?.label ?? "All";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-xl transition-all text-[11px] uppercase tracking-wider ${
          isFiltered
            ? "bg-[var(--fintheon-accent)]/8 text-[var(--fintheon-accent)]"
            : "bg-[var(--fintheon-bg)]/80 text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)]/80"
        }`}
        style={{ fontFamily: "var(--font-heading)" }}
      >
        <Calendar className="w-3.5 h-3.5" />
        {label}
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-1.5 w-36 rounded-xl border bg-[var(--fintheon-bg)] shadow-2xl overflow-hidden"
          style={{
            borderColor:
              "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
          }}
        >
          <div className="py-1">
            {TIMEFRAME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onSelect(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-2 text-left transition-all duration-150 ${
                  selected === opt.value
                    ? "bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
                    : "text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)]/80 hover:bg-[var(--fintheon-accent)]/3"
                }`}
              >
                <span
                  className="text-[12px] font-medium"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Narrative Visibility Filter Dropdown ──────────────────────────
// [claude-code 2026-04-04] Unified color scheme: Yellow=monetary, Purple=structural, Teal=market/secular, Red=geopolitical
const NARRATIVE_THREADS = [
  {
    slug: "middle-east-conflict",
    title: "Middle Eastern Conflict",
    color: "#EF4444",
    shortTitle: "Middle East",
  },
  {
    slug: "liquidity-credit-contraction",
    title: "Liquidity & Credit",
    color: "#A855F7",
    shortTitle: "Liquidity",
  },
  {
    slug: "ai-singularity",
    title: "The Singularity",
    color: "#14B8A6",
    shortTitle: "AI",
  },
  {
    slug: "usd-jpy-carry-trade",
    title: "USD-JPY Carry Trade",
    color: "#A855F7",
    shortTitle: "Carry Trade",
  },
  {
    slug: "trade-war",
    title: "Trade War",
    color: "#EF4444",
    shortTitle: "Trade War",
  },
  {
    slug: "us-china-relations",
    title: "US-China Relations",
    color: "#A855F7",
    shortTitle: "US-China",
  },
  {
    slug: "rate-cut-cycle",
    title: "Rate Cut Cycle",
    color: "#EAB308",
    shortTitle: "Rate Cuts",
  },
  {
    slug: "trump-presidency",
    title: "Trump Presidency",
    color: "#EF4444",
    shortTitle: "Trump",
  },
  {
    slug: "price-stability",
    title: "Price Stability",
    color: "#EAB308",
    shortTitle: "Inflation",
  },
  {
    slug: "maximum-employment",
    title: "Max Employment",
    color: "#EAB308",
    shortTitle: "Employment",
  },
] as const;

const THEME_GROUPS: { name: string; color: string; slugs: string[] }[] = [
  {
    name: "Geopolitical",
    color: "#EF4444",
    slugs: ["middle-east-conflict", "trade-war", "trump-presidency"],
  },
  {
    name: "Structural",
    color: "#A855F7",
    slugs: [
      "liquidity-credit-contraction",
      "usd-jpy-carry-trade",
      "us-china-relations",
    ],
  },
  {
    name: "Monetary Policy",
    color: "#EAB308",
    slugs: ["rate-cut-cycle", "price-stability", "maximum-employment"],
  },
  { name: "Market / Secular", color: "#14B8A6", slugs: ["ai-singularity"] },
];

type ViewMode = "narratives" | "themes";

function NarrativeFilterDropdown({
  visibleLaneIds,
  onToggleLane,
  onSelectAll,
  onClearAll,
  catalysts,
}: {
  visibleLaneIds: Set<string>;
  onToggleLane: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  catalysts: CatalystCard[];
}) {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("narratives");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Count catalysts per thread
  const countByThread = new Map<string, number>();
  for (const c of catalysts) {
    const slug = c.narrative ?? c.narrativeThreads?.[0];
    if (slug) countByThread.set(slug, (countByThread.get(slug) ?? 0) + 1);
  }

  const showAll = visibleLaneIds.size === 0;
  const hiddenCount = showAll
    ? 0
    : NARRATIVE_THREADS.length - visibleLaneIds.size;

  const handleToggleTheme = (slugs: string[]) => {
    const allVisible = slugs.every((s) => showAll || visibleLaneIds.has(s));
    if (allVisible) {
      // If showing all, switch to explicit mode first then remove these
      if (showAll) {
        const allSlugs = new Set(
          NARRATIVE_THREADS.map((t) => t.slug).filter(
            (s) => !slugs.includes(s),
          ),
        );
        // We need to set visible to everything except these slugs
        for (const s of allSlugs) onToggleLane(s);
        // This requires a batch — instead, toggle each slug off
        // Since showAll means visibleLaneIds is empty, we need to first select all then deselect theme
        onSelectAll(); // sets all visible
        // Now toggle off each slug in the theme
        for (const s of slugs) onToggleLane(s);
      } else {
        for (const s of slugs) {
          if (visibleLaneIds.has(s)) onToggleLane(s);
        }
      }
    } else {
      for (const s of slugs) {
        if (!showAll && !visibleLaneIds.has(s)) onToggleLane(s);
        // When showAll, all are visible — toggling individual ones switches to explicit mode
      }
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-xl transition-all text-[11px] uppercase tracking-wider ${
          hiddenCount > 0
            ? "bg-[var(--fintheon-accent)]/8 text-[var(--fintheon-accent)]"
            : "bg-[var(--fintheon-bg)]/80 text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)]/80"
        }`}
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {hiddenCount > 0 ? (
          <EyeOff className="w-3.5 h-3.5" />
        ) : (
          <Eye className="w-3.5 h-3.5" />
        )}
        {hiddenCount > 0
          ? `${hiddenCount} hidden`
          : viewMode === "narratives"
            ? "Narratives"
            : "Themes"}
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-1.5 w-72 rounded-xl border bg-[var(--fintheon-bg)] shadow-2xl overflow-hidden"
          style={{
            borderColor:
              "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
          }}
        >
          {/* Narratives / Themes segmented toggle */}
          <div className="flex items-center gap-1 px-4 pt-3 pb-1.5">
            {(["narratives", "themes"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex-1 text-center py-1 rounded text-[10px] uppercase tracking-wider transition-all ${
                  viewMode === mode
                    ? "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]"
                    : "text-[var(--fintheon-muted)]/40 hover:text-[var(--fintheon-muted)]/70"
                }`}
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Header with Select All / Clear All */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--fintheon-accent)]/10">
            <span
              className="text-[10px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Show / Hide {viewMode === "narratives" ? "Narratives" : "Themes"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onClearAll();
                }}
                className="text-[9px] text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] transition-colors"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                All
              </button>
              <span className="text-[var(--fintheon-muted)]/20">|</span>
              <button
                onClick={onSelectAll}
                className="text-[9px] text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] transition-colors"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                None
              </button>
            </div>
          </div>

          {/* Toggles list */}
          <div className="py-1.5 max-h-80 overflow-y-auto">
            {viewMode === "narratives"
              ? NARRATIVE_THREADS.map((thread) => {
                  const isVisible = showAll || visibleLaneIds.has(thread.slug);
                  const count = countByThread.get(thread.slug) ?? 0;
                  return (
                    <button
                      key={thread.slug}
                      onClick={() => onToggleLane(thread.slug)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-all duration-150 ${
                        isVisible
                          ? "hover:bg-[var(--fintheon-accent)]/3"
                          : "opacity-35 hover:opacity-60"
                      }`}
                    >
                      <div className="relative">
                        <div
                          className="w-3 h-3 rounded-sm transition-opacity"
                          style={{
                            backgroundColor: thread.color,
                            opacity: isVisible ? 1 : 0.3,
                          }}
                        />
                        {!isVisible && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-full h-px bg-[var(--fintheon-text)]/40 rotate-45" />
                          </div>
                        )}
                      </div>
                      <span
                        className={`flex-1 text-[12px] font-medium transition-colors ${
                          isVisible
                            ? "text-[var(--fintheon-text)]/80"
                            : "text-[var(--fintheon-muted)]/40"
                        }`}
                        style={{
                          fontFamily: "var(--font-body)",
                          color: isVisible ? thread.color : undefined,
                        }}
                      >
                        {thread.title}
                      </span>
                      <span
                        className="text-[10px] text-[var(--fintheon-muted)]/40"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {count}
                      </span>
                      {isVisible ? (
                        <Eye className="w-3.5 h-3.5 text-[var(--fintheon-muted)]/30" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-[var(--fintheon-muted)]/20" />
                      )}
                    </button>
                  );
                })
              : THEME_GROUPS.map((theme) => {
                  const allVisible = theme.slugs.every(
                    (s) => showAll || visibleLaneIds.has(s),
                  );
                  const someVisible = theme.slugs.some(
                    (s) => showAll || visibleLaneIds.has(s),
                  );
                  const totalCount = theme.slugs.reduce(
                    (sum, s) => sum + (countByThread.get(s) ?? 0),
                    0,
                  );
                  return (
                    <button
                      key={theme.name}
                      onClick={() => handleToggleTheme(theme.slugs)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 ${
                        allVisible
                          ? "hover:bg-[var(--fintheon-accent)]/3"
                          : someVisible
                            ? "opacity-60 hover:opacity-80"
                            : "opacity-35 hover:opacity-60"
                      }`}
                    >
                      <div className="relative">
                        <div
                          className="w-3 h-3 rounded-sm transition-opacity"
                          style={{
                            backgroundColor: theme.color,
                            opacity: allVisible ? 1 : someVisible ? 0.6 : 0.3,
                          }}
                        />
                        {!allVisible && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-full h-px bg-[var(--fintheon-text)]/40 rotate-45" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-[12px] font-medium transition-colors block ${
                            allVisible
                              ? "text-[var(--fintheon-text)]/80"
                              : "text-[var(--fintheon-muted)]/40"
                          }`}
                          style={{
                            fontFamily: "var(--font-body)",
                            color: allVisible ? theme.color : undefined,
                          }}
                        >
                          {theme.name}
                        </span>
                        <span
                          className="text-[9px] text-[var(--fintheon-muted)]/30 truncate block"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {theme.slugs
                            .map(
                              (s) =>
                                NARRATIVE_THREADS.find((t) => t.slug === s)
                                  ?.shortTitle,
                            )
                            .join(", ")}
                        </span>
                      </div>
                      <span
                        className="text-[10px] text-[var(--fintheon-muted)]/40"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {totalCount}
                      </span>
                      {allVisible ? (
                        <Eye className="w-3.5 h-3.5 text-[var(--fintheon-muted)]/30" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-[var(--fintheon-muted)]/20" />
                      )}
                    </button>
                  );
                })}
          </div>
        </div>
      )}
    </div>
  );
}
