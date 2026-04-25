// [claude-code 2026-04-24] S37: (1) text typography bumped, (2) S24-T3 placeholder retired — fuses always render with an inline degraded-mode banner on fetch fail, (3) Advanced pane gets a right-justified lock gate via the shared dev-settings password ("glass of a data center" — always readable, mutations gated), (4) regime approval queue clears+fades when the most-recent proposal is approved.
// [claude-code 2026-04-24] S34-T2: Layout flip — main pane (75%) now carries regime/fuses/presets/advanced; feed shrinks to a 25% right panel (min 280, max 420). GroupSensitivityDial swapped for NotchedFuse (same -1..+1 contract). Nothing-design pass: flat surfaces, accent borders, dotted dividers, Doto numerals. No glass.
// [claude-code 2026-04-19] S28: RoutinesConsole moved out of Scoring sidebar into the Monitor sub-tab. Scoring sidebar keeps Regime / Sensitivity / Presets / Advanced.
// [claude-code 2026-04-20] S27 final-sanitation: thread auth token into V4 preset fetches + wrap loadV4State in try/catch so a rejected fetch never deadlocks the loader. Prior release stuck forever on "Loading Refinement Engine...".
// [claude-code 2026-04-18] S24-T4: Rebuilt — 5 group dials + presets + advanced pane + toasts + rescore preview
// [claude-code 2026-03-27] S2-T7: Refinement Engine — scoring calibration workbench
import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, ChevronRight, RefreshCw, Wrench } from "lucide-react";
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
import { AnnotatableItem } from "./AnnotatableItem";
import { NotchedFuse } from "./NotchedFuse";
import {
  SENSITIVITY_DEFAULTS,
  type SensitivityGroup,
  type SensitivityValues,
} from "./GroupSensitivityDial";
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

interface RegimeState {
  regime: MarketRegime;
  confidence: number;
  detectedBy: string;
  multipliers?: Record<string, number>;
}

const GROUPS: SensitivityGroup[] = [
  "macro",
  "geopolitical",
  "corporate",
  "technical",
  "speaker",
];

function sameSensitivities(
  a: SensitivityValues,
  b: SensitivityValues,
): boolean {
  return GROUPS.every((g) => Math.abs(a[g] - b[g]) < 0.001);
}

export function RefinementEngine() {
  const { addToast } = useToast();
  const { getAccessToken } = useAuth();

  const [items, setItems] = useState<RiskFlowAlert[]>([]);
  const [regime, setRegime] = useState<RegimeState | null>(null);
  const [weights, setWeights] = useState<CalibrationEntry[]>([]);
  const [registry, setRegistry] = useState<CommentatorEntry[]>([]);
  const [sourceAccounts, setSourceAccounts] = useState<SourceAccount[]>([]);
  // [claude-code 2026-04-24] S34-T1
  const [econFilters, setEconFilters] = useState<EconWatchFilter[]>([]);
  const [isRescoring, setIsRescoring] = useState(false);
  const [loading, setLoading] = useState(true);
  // [claude-code 2026-04-25] S38: Group Sensitivity collapsible + view-only gating tied to S37 lock.
  const [groupSensOpen, setGroupSensOpen] = useState(true);
  // Drive t-panel-slide data-open via rAF on open transitions so the entry
  // tween renders from the closed (translate-Y + blur + opacity:0) state.
  const [groupSensRevealed, setGroupSensRevealed] = useState(true);
  useEffect(() => {
    if (!groupSensOpen) {
      setGroupSensRevealed(false);
      return;
    }
    const id = requestAnimationFrame(() => setGroupSensRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [groupSensOpen]);
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

  // V4: group sensitivities + preset state
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

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/riskflow/feed`).then((r) =>
        r.json(),
      );
      setItems(res.items ?? []);
    } catch {
      /* silent — empty list preserved */
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

  // [claude-code 2026-04-24] S34-T1
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
      // Select closest matching preset, fall back to neutral
      const match = combined.find((p) =>
        sameSensitivities(p.sensitivities, currentRes),
      );
      setSelectedPresetId(match?.id ?? null);
      setV4Available(true);
    } catch {
      // Any unexpected failure here must NOT deadlock the loader — the
      // other fetchers are silent-on-failure, so loadV4State matches
      // that contract by flagging V4 unavailable and letting the
      // Advanced pane + built-in presets still render.
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

  // Debounced rescore preview when sensitivities change
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

  const onDialChange = useCallback(
    (group: SensitivityGroup, value: number) => {
      setPendingSensitivities((prev) => {
        const next = { ...prev, [group]: value };
        const match = presets.find((p) =>
          sameSensitivities(p.sensitivities, next),
        );
        setSelectedPresetId(match?.id ?? null);
        return next;
      });
    },
    [presets],
  );

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
      // Prefer rescore-all (V4); fall back to legacy /rescore on 404
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

  return (
    <div className="h-full flex flex-col bg-[var(--fintheon-bg)]">
      {/* [claude-code 2026-04-25] S38: Header toolbar min-height bumped ~12% so chrome breathes */}
      <div className="flex items-center justify-between px-5 py-4 min-h-[60px] border-b border-[var(--fintheon-accent)]/15">
        <div className="flex items-center gap-3">
          <Wrench className="w-5 h-5 text-[var(--fintheon-accent)]" />
          <h1
            className="text-base font-bold text-[var(--fintheon-text)]"
            style={{
              fontFamily: "var(--font-heading)",
              letterSpacing: "0.12em",
            }}
          >
            REFINEMENT ENGINE
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <>
              <button
                onClick={onDiscardChanges}
                className="px-3 py-2 border border-[var(--fintheon-glass-border)] text-[12px] font-semibold text-[var(--fintheon-muted)] hover:border-[var(--fintheon-accent)]/40"
              >
                Discard
              </button>
              <button
                onClick={onApplyChanges}
                className="px-4 py-2 bg-[var(--fintheon-accent)] text-[var(--fintheon-bg)] text-[12px] font-bold tracking-wide"
              >
                Apply Changes
              </button>
            </>
          )}
          <button
            onClick={handleRescore}
            disabled={isRescoring}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-[var(--fintheon-accent)]/40 text-[12px] font-semibold text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRescoring ? "animate-spin" : ""}`}
            />
            {isRescoring ? "Re-Scoring…" : "Re-Score All"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[11px] text-zinc-500 animate-pulse">
            Loading Refinement Engine...
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          {/* Main pane (75%) — regime / fuses / presets / advanced */}
          <div className="flex-1 min-w-0 overflow-y-auto p-4">
            <RegimeControl regime={regime} onRegimeChanged={fetchRegime} />

            {v4Available ? (
              <>
                {/* [claude-code 2026-04-25] S38: Group Sensitivity is now a collapsible
                    header row (chevron toggles), keeps flat styling (no card chrome).
                    Fuses render disabled unless the S37 Advanced-pane lock is open. */}
                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 12,
                    borderTop:
                      "1px dotted color-mix(in srgb, var(--fintheon-accent) 35%, transparent)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setGroupSensOpen((v) => !v)}
                    aria-expanded={groupSensOpen}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: "2px 0",
                      marginBottom: 10,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--fintheon-accent)",
                      }}
                    >
                      Group Sensitivity
                    </span>
                    {groupSensOpen ? (
                      <ChevronDown size={14} color="var(--fintheon-muted)" />
                    ) : (
                      <ChevronRight size={14} color="var(--fintheon-muted)" />
                    )}
                  </button>
                  <div
                    className="t-panel-slide"
                    data-open={groupSensRevealed ? "true" : "false"}
                  >
                    {groupSensOpen &&
                      GROUPS.map((g) => (
                        <NotchedFuse
                          key={g}
                          group={g}
                          value={pendingSensitivities[g]}
                          onChange={onDialChange}
                          disabled={!editUnlocked}
                        />
                      ))}
                  </div>
                </div>

                {/* PresetSelector relocated into AdvancedPane below — sits inside the locked region per S38. */}

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
                degrading to Advanced per-event controls. Fuses stay usable;
                changes won&apos;t persist until the service is back.
              </div>
            )}

            <AdvancedPane
              count={weights.length + registry.length + sourceAccounts.length}
            >
              {/* [claude-code 2026-04-25] S38: Preset dropdown moved INSIDE the locked Advanced
                  pane — read-only when locked, interactive when unlocked. */}
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
              />
              <div
                style={{ borderTop: "1px solid var(--fintheon-glass-border)" }}
              />
              {/* [claude-code 2026-04-24] S34-T1: Econ watch filters */}
              <EconFiltersManager
                filters={econFilters}
                onFiltersChanged={fetchEconFilters}
              />
            </AdvancedPane>
          </div>

          {/* Right panel (25%, min 280, max 420) — annotatable feed preview */}
          <div className="w-1/4 min-w-[280px] max-w-[420px] shrink-0 border-l border-[var(--fintheon-accent)]/20 overflow-y-auto p-3 space-y-2">
            <div
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--fintheon-muted)",
                marginBottom: 4,
              }}
            >
              Feed Preview · {items.length} item{items.length !== 1 ? "s" : ""}
            </div>

            {items.length === 0 ? (
              <div className="text-center py-12 text-[11px] text-zinc-600">
                No feed items. Backend may need to be running.
              </div>
            ) : (
              items.map((item) => (
                <AnnotatableItem
                  key={item.id}
                  item={item}
                  onAnnotationSaved={() => {}}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
