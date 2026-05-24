// [claude-code 2026-04-29] S53-T2: RefinementEngine refactored into a module shell.
// Runtime health (pipeline stats/states, source accounts, econ filters) now
// flows through useRiskflowRuntime — one canonical payload. Child panels receive
// standardized lastAppliedAt / isMutating / degradedReason props. Scoring logic
// (presets, sensitivities, rescore) stays in this shell since it orchestrates
// across pipeline + V4 calibration concerns.
// [claude-code 2026-04-28] S48-T3: Group Sensitivity NotchedFuse section removed
// and replaced with PipelineHealth table + PipelineToggles. CountdownFuse added.
// Error handling hardened: silent catch blocks replaced with inline error states.
// [claude-code 2026-04-27] S46.4: Right rail now stacks Catalyst Stats panel.
// [claude-code 2026-04-24] S37: text typography, fuses, Advanced pane lock gate, regime queue.
// [claude-code 2026-04-24] S34-T2: Layout flip, NotchedFuse swap, Nothing-design pass.
// [claude-code 2026-04-19] S28: RoutinesConsole moved to Monitor sub-tab.
// [claude-code 2026-04-20] S27: auth token into V4 preset fetches.
// [claude-code 2026-04-18] S24-T4: Rebuilt scoring calibration workbench.
// [claude-code 2026-03-27] S2-T7: Refinement Engine
import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, CubeFocus, AlertTriangle, X, Tv } from "lucide-react";
import { isRefinementEditUnlocked } from "../../lib/dev-settings-auth";
import type { RiskFlowAlert } from "../../lib/riskflow-feed";
import type { CalibrationEntry } from "../../../backend-hono/src/types/calibration";
import type { CommentatorEntry } from "../../../backend-hono/src/types/commentator";
import type { SourceAccount } from "../../../backend-hono/src/types/source-account";
import type { EconWatchFilter } from "../../../backend-hono/src/types/econ-watch-filter";
import type { MarketRegime } from "../../types/regime";
import { RegimeControl } from "./RegimeControl";
import { QuickWeightEditor } from "./QuickWeightEditor";
import { CommentatorManager } from "./CommentatorManager";
import { SourceAccountsManager } from "./SourceAccountsManager";
import { EconFiltersManager } from "./EconFiltersManager";
import { CatalystStatsDrawer } from "./CatalystStatsDrawer";
import { PipelineHealth } from "./PipelineHealth";
import { PipelineToggles } from "./PipelineToggles";
import { OperatorTimeline } from "./OperatorTimeline";
import { SourcePolicyPanel } from "./SourcePolicyPanel";
import { DoctoringPanel } from "./DoctoringPanel";
import { FinancialJuiceBackfillPanel } from "./FinancialJuiceBackfillPanel";
import { EmbeddedBrowserFrame } from "../layout/EmbeddedBrowserFrame";
import {
  PresetSelector,
  BUILTIN_PRESETS,
  type ScoringPreset,
} from "./PresetSelector";
import { AdvancedPane } from "./AdvancedPane";
import { MatrixEditor } from "./MatrixEditor";
import { LexiconEditor } from "./LexiconEditor";
import { ScoreImpactPreview } from "../ui/InlineDiff";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { useRiskflowRuntime } from "../../hooks/useRiskflowRuntime";
import {
  fetchPresets,
  fetchCurrentSensitivities,
  applySensitivities,
  savePresetAs,
  previewRescore,
  triggerRescore,
  isNotReady,
} from "../../lib/scoring-preset-api";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

type SensitivityGroup =
  | "macro"
  | "geopolitical"
  | "corporate"
  | "technical"
  | "speaker";

interface SensitivityValues {
  macro: number;
  geopolitical: number;
  corporate: number;
  technical: number;
  speaker: number;
}

const SENSITIVITY_DEFAULTS: SensitivityValues = {
  macro: 0,
  geopolitical: 0,
  corporate: 0,
  technical: 0,
  speaker: 0,
};

const GROUPS: SensitivityGroup[] = [
  "macro",
  "geopolitical",
  "corporate",
  "technical",
  "speaker",
];

interface RegimeState {
  regime: MarketRegime;
  confidence: number;
  detectedBy: string;
  multipliers?: Record<string, number>;
}

interface KickstartSourceStat {
  handle: string;
  fetched: number;
  candidates: number;
  accepted: number;
}

interface KickstartResult {
  success: boolean;
  handles: number;
  selectedHandles: string[];
  fetched: number;
  fetchedRettiwt?: number;
  fetchedXActions?: number;
  xactionsEnabled?: boolean;
  xactionsFallbackHandles?: string[];
  candidateItems: number;
  written: number;
  rescored: number;
  perSource: KickstartSourceStat[];
  kickedAt: string;
}

function sameSensitivities(
  a: SensitivityValues,
  b: SensitivityValues,
): boolean {
  return GROUPS.every((g) => Math.abs(a[g] - b[g]) < 0.001);
}

function isWebSourceHandle(handle: string): boolean {
  return handle.includes(".") || handle.startsWith("http");
}

export function RefinementEngine() {
  const { addToast } = useToast();
  const { getAccessToken } = useAuth();

  // --- Runtime health (one canonical payload) ---
  const {
    pipelineStats,
    pipelineStates,
    sourceAccounts: sourceSummary,
    econFilters: econSummary,
    statsLoading,
    statesLoading,
    statsError,
    statesError,
    lastAppliedAt,
    isMutating,
    degradedReason,
    refetchStats,
    togglePipeline,
  } = useRiskflowRuntime();

  // --- Feed cache (retained for rescore invalidation) ---
  const [items, setItems] = useState<RiskFlowAlert[]>([]);

  // --- Scoring state ---
  const [regime, setRegime] = useState<RegimeState | null>(null);
  const [weights, setWeights] = useState<CalibrationEntry[]>([]);
  const [registry, setRegistry] = useState<CommentatorEntry[]>([]);
  const [sourceAccounts, setSourceAccounts] = useState<SourceAccount[]>([]);
  const [econFilters, setEconFilters] = useState<EconWatchFilter[]>([]);
  const [isRescoring, setIsRescoring] = useState(false);
  const [isRefreshingAuth, setIsRefreshingAuth] = useState(false);
  const [isKickstartDrawerOpen, setIsKickstartDrawerOpen] = useState(false);
  const [kickstartHandles, setKickstartHandles] = useState<Set<string>>(
    () => new Set(),
  );
  const [lastKickstart, setLastKickstart] = useState<KickstartResult | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  // --- Plane view mode ---
  const [viewMode, setViewMode] = useState<"scoring" | "plane">("scoring");

  const planeUrl = import.meta.env.VITE_PLANE_URL || "https://app.plane.so";

  // --- Edit lock ---
  const [editUnlocked, setEditUnlocked] = useState(() =>
    isRefinementEditUnlocked(),
  );
  useEffect(() => {
    const sync = () => setEditUnlocked(isRefinementEditUnlocked());
    const interval = window.setInterval(sync, 1500);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  // --- V4 scoring state ---
  const [appliedSensitivities, setAppliedSensitivities] =
    useState<SensitivityValues>(SENSITIVITY_DEFAULTS);
  const [pendingSensitivities, setPendingSensitivities] =
    useState<SensitivityValues>(SENSITIVITY_DEFAULTS);
  const [presets, setPresets] = useState<ScoringPreset[]>(BUILTIN_PRESETS);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    BUILTIN_PRESETS[0].id,
  );
  const [preview, setPreview] = useState<{
    itemsAffected: number;
    bucketDeltas: { bucket: string; before: number; after: number }[];
  } | null>(null);
  const [previewStale, setPreviewStale] = useState(false);
  const [v4Available, setV4Available] = useState(true);

  const isDirty = useMemo(
    () => !sameSensitivities(appliedSensitivities, pendingSensitivities),
    [appliedSensitivities, pendingSensitivities],
  );

  // --- Scoring fetchers (kept in shell — calibration concerns) ---
  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/riskflow/feed`).then((r) =>
        r.json(),
      );
      setItems(res.items ?? []);
    } catch {
      /* silent */
    }
  }, []);

  const fetchRegime = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/regime/current`).then((r) =>
        r.json(),
      );
      setRegime(res);
    } catch {
      /* silent */
    }
  }, []);

  const fetchWeights = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/calibration/weights`).then((r) =>
        r.json(),
      );
      setWeights(res.weights ?? []);
    } catch {
      /* silent */
    }
  }, []);

  const fetchRegistry = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/commentator/registry`).then(
        (r) => r.json(),
      );
      setRegistry(res.registry ?? []);
    } catch {
      /* silent */
    }
  }, []);

  // Source accounts + econ filters fetched for AdvancedPane CRUD managers.
  // Summaries come from useRiskflowRuntime; full arrays are needed for the
  // inline editors.
  const fetchSourceAccounts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/source-accounts`).then((r) =>
        r.json(),
      );
      setSourceAccounts(res.accounts ?? []);
    } catch {
      /* silent */
    }
  }, []);

  const fetchEconFilters = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/econ-filters`).then((r) =>
        r.json(),
      );
      setEconFilters(res.filters ?? []);
    } catch {
      /* silent */
    }
  }, []);

  const kickstartSources = useMemo(
    () =>
      sourceAccounts.filter(
        (a) =>
          a.active && a.method === "browser" && !isWebSourceHandle(a.handle),
      ),
    [sourceAccounts],
  );

  useEffect(() => {
    if (kickstartSources.length === 0) {
      setKickstartHandles(new Set());
      return;
    }
    setKickstartHandles((prev) => {
      const allowed = new Set(
        kickstartSources.map((s) => s.handle.toLowerCase()),
      );
      const retained = kickstartSources
        .map((s) => s.handle)
        .filter((h) => prev.has(h) || prev.has(h.toLowerCase()));
      if (retained.length > 0) return new Set(retained);
      return new Set(kickstartSources.map((s) => s.handle));
    });
  }, [kickstartSources]);

  const loadV4State = useCallback(async () => {
    try {
      const token = (await getAccessToken()) ?? undefined;
      const [presetsRes, currentRes] = await Promise.all([
        fetchPresets(token),
        fetchCurrentSensitivities(token),
      ]);
      if (isNotReady(presetsRes) || isNotReady(currentRes)) {
        setV4Available(false);
        return;
      }
      const combined = [...BUILTIN_PRESETS, ...presetsRes];
      setPresets(combined);
      setAppliedSensitivities(currentRes);
      setPendingSensitivities(currentRes);
      const match = combined.find((p) =>
        sameSensitivities(p.sensitivities, currentRes),
      );
      setSelectedPresetId(match?.id ?? null);
      setV4Available(true);
    } catch {
      setV4Available(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchFeed(),
        fetchRegime(),
        fetchWeights(),
        fetchRegistry(),
        fetchSourceAccounts(),
        fetchEconFilters(),
        loadV4State(),
      ]);
      setLoading(false);
    };
    void loadAll();
  }, [
    fetchFeed,
    fetchRegime,
    fetchWeights,
    fetchRegistry,
    fetchSourceAccounts,
    fetchEconFilters,
    loadV4State,
  ]);

  // --- Debounced rescore preview ---
  useEffect(() => {
    if (!v4Available || !isDirty) {
      setPreview(null);
      setPreviewStale(false);
      return;
    }
    setPreviewStale(true);
    const timer = setTimeout(async () => {
      const res = await previewRescore(pendingSensitivities);
      if (isNotReady(res)) {
        setPreview(null);
      } else {
        setPreview(res);
      }
      setPreviewStale(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [pendingSensitivities, isDirty, v4Available]);

  // --- Scoring actions ---
  const onPresetSelect = useCallback((preset: ScoringPreset) => {
    setPendingSensitivities(preset.sensitivities);
    setSelectedPresetId(preset.id);
  }, []);

  const onApplyChanges = useCallback(async () => {
    if (!isDirty) return;
    const token = (await getAccessToken()) ?? undefined;
    const res = await applySensitivities(pendingSensitivities, token);
    if (isNotReady(res)) {
      addToast(
        "Preset API not ready",
        "info",
        "T3 backend endpoints land next — your changes weren't saved.",
      );
      return;
    }
    setAppliedSensitivities(pendingSensitivities);
    addToast(
      "Sensitivities applied",
      "success",
      "Re-Score All to refresh scored items.",
    );
  }, [isDirty, pendingSensitivities, getAccessToken, addToast]);

  const onApplyAndRescore = useCallback(async () => {
    setIsRescoring(true);
    try {
      const token = (await getAccessToken()) ?? undefined;
      if (isDirty) {
        const saveRes = await applySensitivities(pendingSensitivities, token);
        if (!isNotReady(saveRes)) {
          setAppliedSensitivities(pendingSensitivities);
        }
      }
      const res = await triggerRescore(token);
      if (isNotReady(res)) {
        await fetch(`${API_BASE}/api/riskflow/rescore`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({}),
        }).then((r) => r.json());
        addToast("Rescore (V3)", "info", "V4 rescore-all not live yet.");
      } else {
        addToast("Saved & rescored", "success");
      }
      await fetchFeed();
    } catch {
      addToast("Save/rescore failed", "error");
    } finally {
      setIsRescoring(false);
    }
  }, [isDirty, pendingSensitivities, getAccessToken, addToast, fetchFeed]);

  const onDiscardChanges = useCallback(() => {
    setPendingSensitivities(appliedSensitivities);
    const match = presets.find((p) =>
      sameSensitivities(p.sensitivities, appliedSensitivities),
    );
    setSelectedPresetId(match?.id ?? null);
  }, [appliedSensitivities, presets]);

  const onSavePreset = useCallback(
    async (name: string) => {
      const token = (await getAccessToken()) ?? undefined;
      const res = await savePresetAs(name, pendingSensitivities, token);
      if (isNotReady(res)) {
        addToast(
          "Preset API not ready",
          "info",
          "Custom presets unavailable until T3 lands.",
        );
        return;
      }
      setPresets((prev) => [...prev, res]);
      setSelectedPresetId(res.id);
      addToast(`Preset "${name}" saved`, "success");
    },
    [pendingSensitivities, getAccessToken, addToast],
  );

  const handleRescore = async () => {
    setIsRescoring(true);
    try {
      const token = (await getAccessToken()) ?? undefined;
      const res = await triggerRescore(token);
      if (isNotReady(res)) {
        await fetch(`${API_BASE}/api/riskflow/rescore`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({}),
        }).then((r) => r.json());
        addToast("Rescore (V3)", "info", "V4 rescore-all not live yet.");
      } else {
        addToast("Rescore complete", "success");
      }
      await fetchFeed();
    } catch {
      addToast("Rescore failed", "error");
    } finally {
      setIsRescoring(false);
    }
  };

  const handleRefreshAuth = useCallback(async () => {
    if (kickstartHandles.size === 0) {
      addToast("Pick at least one source", "info");
      return;
    }
    setIsRefreshingAuth(true);
    try {
      const token = (await getAccessToken()) ?? undefined;
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const kickstartRes = await fetch(`${API_BASE}/api/riskflow/kickstart`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          handles: Array.from(kickstartHandles),
        }),
      });
      if (!kickstartRes.ok) {
        const text = await kickstartRes.text().catch(() => "");
        throw new Error(text || `HTTP ${kickstartRes.status}`);
      }
      const kickstartJson = (await kickstartRes
        .json()
        .catch(() => null)) as KickstartResult | null;
      setLastKickstart(kickstartJson);

      addToast(
        "Kickstart complete",
        "success",
        `Fetched ${kickstartJson?.fetched ?? 0}, wrote ${kickstartJson?.written ?? 0}`,
      );
      await refetchStats();
      await fetchFeed();
    } catch {
      addToast("Kickstart failed", "error");
    } finally {
      setIsRefreshingAuth(false);
    }
  }, [getAccessToken, addToast, refetchStats, fetchFeed, kickstartHandles]);

  const toggleKickstartHandle = useCallback((handle: string) => {
    setKickstartHandles((prev) => {
      const next = new Set(prev);
      if (next.has(handle)) next.delete(handle);
      else next.add(handle);
      return next;
    });
  }, []);

  return (
    <div className="h-full flex flex-col bg-[var(--fintheon-bg)] relative">
      {/* Header toolbar — compact, no borders */}
      <div className="flex items-center justify-between px-5 py-3">
        <h1
          className="text-sm font-bold text-[var(--fintheon-text)]"
          style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.12em" }}
        >
          REFINEMENT ENGINE
        </h1>
        <div className="flex items-center gap-3">
          {viewMode === "scoring" && (
            <>
              <button
                onClick={() => setViewMode("plane")}
                className="flex items-center gap-1.5 text-xs font-medium text-[var(--fintheon-accent)]/70 hover:text-[var(--fintheon-accent)] transition-colors"
                title="Open Plane"
              >
                <Tv className="w-3.5 h-3.5" />
                Plane
              </button>
              <span
                style={{
                  width: 1,
                  height: 14,
                  background: "rgba(199,159,74,0.15)",
                }}
              />
            </>
          )}
          {viewMode === "plane" ? (
            <button
              onClick={() => setViewMode("scoring")}
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--fintheon-accent)]/70 hover:text-[var(--fintheon-accent)] transition-colors"
            >
              <CubeFocus className="w-3.5 h-3.5" />
              Scoring
            </button>
          ) : (
            <>
              {isDirty && (
                <button
                  onClick={onDiscardChanges}
                  className="text-[11px] font-medium text-[var(--fintheon-muted)] hover:text-[var(--fintheon-accent)] transition-colors"
                >
                  Discard
                </button>
              )}
              <button
                onClick={onApplyAndRescore}
                disabled={isRescoring}
                className="text-[11px] font-semibold text-[var(--fintheon-accent)] hover:opacity-80 disabled:opacity-40 transition-opacity"
              >
                {isRescoring ? "Saving…" : "Save"}
              </button>
              <span
                style={{
                  width: 1,
                  height: 14,
                  background: "rgba(199,159,74,0.15)",
                }}
              />
              <button
                onClick={() => setIsKickstartDrawerOpen(true)}
                disabled={isRefreshingAuth || kickstartSources.length === 0}
                className="flex items-center gap-1.5 text-xs font-medium text-[var(--fintheon-accent)]/70 hover:text-[var(--fintheon-accent)] disabled:opacity-30 transition-colors"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshingAuth ? "animate-spin" : ""}`}
                />
                Kickstart
              </button>
            </>
          )}
        </div>
      </div>
      <div
        style={{
          height: 1,
          margin: "0 20px",
          background:
            "linear-gradient(to right, rgba(199,159,74,0.18), transparent 80%)",
        }}
      />

      {viewMode === "scoring" && isKickstartDrawerOpen && (
        <div className="absolute inset-0 z-40">
          <button
            className="absolute inset-0 bg-black/35"
            onClick={() => setIsKickstartDrawerOpen(false)}
            aria-label="Close kickstart drawer"
          />
          <aside className="fintheon-rail-surface absolute right-0 top-0 h-full w-[420px] border-l border-[var(--fintheon-accent)]/25 bg-[var(--fintheon-bg)] shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--fintheon-accent)]/20">
              <div>
                <div className="text-[12px] font-bold tracking-[0.12em] text-[var(--fintheon-text)]">
                  KICKSTART
                </div>
                <div className="text-[10px] text-[var(--fintheon-muted)] mt-1">
                  Toggle sources, then run filtered pull.
                </div>
              </div>
              <button
                onClick={() => setIsKickstartDrawerOpen(false)}
                className="p-1 text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 h-[calc(100%-58px)] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-semibold text-[var(--fintheon-muted)]">
                  Sources ({kickstartSources.length})
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setKickstartHandles(
                        new Set(kickstartSources.map((s) => s.handle)),
                      )
                    }
                    className="text-[10px] text-[var(--fintheon-accent)]"
                  >
                    All
                  </button>
                  <button
                    onClick={() => setKickstartHandles(new Set())}
                    className="text-[10px] text-[var(--fintheon-muted)]"
                  >
                    None
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {kickstartSources.map((src) => {
                  const enabled = kickstartHandles.has(src.handle);
                  return (
                    <div
                      key={src.id}
                      className="flex items-center justify-between px-3 py-2 border border-[var(--fintheon-glass-border)]"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-[var(--fintheon-text)] truncate">
                          @{src.handle}
                        </div>
                        <div className="text-[10px] text-[var(--fintheon-muted)] truncate">
                          {src.display_name ?? src.category}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleKickstartHandle(src.handle)}
                        className={`w-10 h-5 rounded-full border transition-colors ${
                          enabled
                            ? "bg-[var(--fintheon-accent)] border-[var(--fintheon-accent)]"
                            : "bg-transparent border-[var(--fintheon-glass-border)]"
                        }`}
                        aria-label={`Toggle ${src.handle}`}
                      >
                        <span
                          className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                            enabled ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleRefreshAuth}
                disabled={isRefreshingAuth || kickstartHandles.size === 0}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--fintheon-accent)] text-[var(--fintheon-bg)] text-[12px] font-bold disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isRefreshingAuth ? "animate-spin" : ""}`}
                />
                {isRefreshingAuth ? "Running…" : "Run Kickstart"}
              </button>

              {lastKickstart && (
                <div className="mt-4 border border-[var(--fintheon-glass-border)]">
                  <div className="px-3 py-2 border-b border-[var(--fintheon-glass-border)] text-[10px] text-[var(--fintheon-muted)]">
                    Last run:{" "}
                    {new Date(lastKickstart.kickedAt).toLocaleString()}
                  </div>
                  <div className="px-3 py-2 text-[11px] text-[var(--fintheon-text)]">
                    fetched {lastKickstart.fetched} · candidates{" "}
                    {lastKickstart.candidateItems} · written{" "}
                    {lastKickstart.written}
                  </div>
                  <div className="px-3 pb-1 text-[10px] text-[var(--fintheon-muted)]">
                    rettiwt {lastKickstart.fetchedRettiwt ?? 0} · xactions{" "}
                    {lastKickstart.fetchedXActions ?? 0}
                  </div>
                  <div className="px-3 pb-3 space-y-1">
                    {lastKickstart.perSource?.map((s) => (
                      <div
                        key={s.handle}
                        className="flex items-center justify-between text-[10px] text-[var(--fintheon-muted)]"
                      >
                        <span>@{s.handle}</span>
                        <span>
                          {s.fetched}/{s.candidates}/{s.accepted}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[11px] text-zinc-500 animate-pulse">
            Loading Refinement Engine...
          </div>
        </div>
      ) : viewMode === "plane" ? (
        <div className="flex-1 min-h-0">
          <EmbeddedBrowserFrame
            title="Plane"
            src={planeUrl}
            className="w-full h-full"
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          {/* Main pane — regime / pipeline panels / presets / advanced */}
          <div className="flex-1 min-w-0 overflow-y-auto p-4">
            <RegimeControl regime={regime} onRegimeChanged={fetchRegime} />

            {/* Shared runtime status bar (one payload → one view) */}
            {degradedReason && (
              <div
                style={{
                  marginTop: 12,
                  padding: "6px 10px",
                  background:
                    "color-mix(in srgb, var(--fintheon-accent) 6%, transparent)",
                  borderLeft:
                    "3px solid color-mix(in srgb, var(--fintheon-accent) 50%, transparent)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                }}
              >
                <AlertTriangle className="w-3 h-3 text-[var(--fintheon-accent)]" />
                <span style={{ color: "var(--fintheon-accent)" }}>
                  degraded
                </span>
                <span style={{ color: "var(--fintheon-muted)" }}>
                  {degradedReason}
                </span>
              </div>
            )}

            <PipelineHealth
              stats={pipelineStats}
              loading={statsLoading}
              error={statsError}
              onRetry={refetchStats}
              lastAppliedAt={lastAppliedAt}
              isMutating={isMutating}
              degradedReason={degradedReason}
            />
            <div className="mt-3 grid grid-cols-1 2xl:grid-cols-2 gap-3 items-start">
              <PipelineToggles
                pipelines={pipelineStates}
                onToggle={togglePipeline}
                disabled={!editUnlocked}
                loading={statesLoading}
                error={statesError}
                lastAppliedAt={lastAppliedAt}
                isMutating={isMutating}
                degradedReason={degradedReason}
              />
              <CatalystStatsDrawer inline disabled={!editUnlocked} />
            </div>

            {/* [claude-code 2026-04-29] S53-T4B: Operator hardening panels —
                source policy enforcement visibility, ingest activity timeline,
                and doctoring queue. Independent degrade — one failure doesn't
                blank other controls. */}
            <SourcePolicyPanel />
            <OperatorTimeline />
            <DoctoringPanel />
            <FinancialJuiceBackfillPanel />

            {v4Available ? (
              <>
                {isDirty && (
                  <div style={{ marginBottom: 12 }}>
                    {previewStale ? (
                      <div
                        style={{
                          padding: "8px 12px",
                          fontSize: 11,
                          color: "var(--fintheon-muted)",
                          fontFamily: "var(--font-data)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Previewing impact…
                      </div>
                    ) : preview ? (
                      <ScoreImpactPreview
                        deltas={preview.bucketDeltas}
                        itemsAffected={preview.itemsAffected}
                      />
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 14px",
                  border:
                    "1px dashed color-mix(in srgb, var(--fintheon-accent) 35%, transparent)",
                  borderRadius: 0,
                  fontSize: 13,
                  color: "var(--fintheon-muted)",
                  fontFamily: "var(--font-body)",
                  lineHeight: 1.5,
                }}
              >
                V4 preset service unreachable — loading built-in presets and
                degrading to Advanced per-event controls. Changes won&apos;t
                persist until the service is back.
              </div>
            )}

            <AdvancedPane
              count={weights.length + registry.length + sourceAccounts.length}
            >
              <PresetSelector
                presets={presets}
                selectedId={selectedPresetId}
                onSelect={onPresetSelect}
                onSaveCurrent={onSavePreset}
                disabled={!editUnlocked}
              />
              <div
                style={{
                  borderTop:
                    "1px dotted color-mix(in srgb, var(--fintheon-accent) 25%, transparent)",
                }}
              />
              <MatrixEditor />
              <div
                style={{
                  borderTop:
                    "1px dotted color-mix(in srgb, var(--fintheon-accent) 25%, transparent)",
                }}
              />
              <LexiconEditor />
              <div
                style={{
                  borderTop:
                    "1px dotted color-mix(in srgb, var(--fintheon-accent) 25%, transparent)",
                }}
              />
              <QuickWeightEditor
                weights={weights}
                onWeightsSaved={fetchWeights}
              />
              <div
                style={{
                  borderTop:
                    "1px dotted color-mix(in srgb, var(--fintheon-accent) 25%, transparent)",
                }}
              />
              <CommentatorManager
                registry={registry}
                onRegistryChanged={fetchRegistry}
              />
              <div
                style={{
                  borderTop:
                    "1px dotted color-mix(in srgb, var(--fintheon-accent) 25%, transparent)",
                }}
              />
              <SourceAccountsManager
                accounts={sourceAccounts}
                onAccountsChanged={fetchSourceAccounts}
                lastAppliedAt={lastAppliedAt}
                isMutating={isMutating}
                degradedReason={sourceSummary.error ?? degradedReason}
              />
              <div
                style={{ borderTop: "1px solid var(--fintheon-glass-border)" }}
              />
              <EconFiltersManager
                filters={econFilters}
                onFiltersChanged={fetchEconFilters}
              />
            </AdvancedPane>
          </div>
        </div>
      )}
    </div>
  );
}
