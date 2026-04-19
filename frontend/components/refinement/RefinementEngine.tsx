// [claude-code 2026-04-20] S27 final-sanitation: thread auth token into V4 preset fetches + wrap loadV4State in try/catch so a rejected fetch never deadlocks the loader. Prior release stuck forever on "Loading Refinement Engine...".
// [claude-code 2026-04-18] S24-T4: Rebuilt — 5 group dials + presets + advanced pane + toasts + rescore preview
// [claude-code 2026-03-27] S2-T7: Refinement Engine — scoring calibration workbench
import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Wrench } from "lucide-react";
import type { RiskFlowAlert } from "../../lib/riskflow-feed";
import type { CalibrationEntry } from "../../../backend-hono/src/types/calibration";
import type { CommentatorEntry } from "../../../backend-hono/src/types/commentator";
import type { SourceAccount } from "../../../backend-hono/src/types/source-account";
import type { MarketRegime } from "../../types/regime";
import { RegimeControl } from "./RegimeControl";
import { QuickWeightEditor } from "./QuickWeightEditor";
import { CommentatorManager } from "./CommentatorManager";
import { SourceAccountsManager } from "./SourceAccountsManager";
import { AnnotatableItem } from "./AnnotatableItem";
import {
  GroupSensitivityDial,
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
import { RoutinesConsole } from "./RoutinesConsole";
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
  const [isRescoring, setIsRescoring] = useState(false);
  const [loading, setLoading] = useState(true);

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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--fintheon-accent)]/15">
        <div className="flex items-center gap-2.5">
          <Wrench className="w-4 h-4 text-[var(--fintheon-accent)]" />
          <h1 className="text-sm font-bold text-[var(--fintheon-text)] tracking-wide">
            REFINEMENT ENGINE
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <>
              <button
                onClick={onDiscardChanges}
                className="px-2.5 py-1.5 rounded border border-[var(--fintheon-glass-border)] text-[11px] text-[var(--fintheon-muted)] hover:border-[var(--fintheon-accent)]/40"
              >
                Discard
              </button>
              <button
                onClick={onApplyChanges}
                className="px-3 py-1.5 rounded bg-[var(--fintheon-accent)] text-[var(--fintheon-bg)] text-[11px] font-bold"
              >
                Apply Changes
              </button>
            </>
          )}
          <button
            onClick={handleRescore}
            disabled={isRescoring}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--fintheon-accent)]/40 text-[11px] font-semibold text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRescoring ? "animate-spin" : ""}`}
            />
            {isRescoring ? "Re-Scoring..." : "Re-Score All"}
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
          {/* Left panel — routines console + V4 group dials + regime + presets + advanced pane */}
          <div className="w-[340px] shrink-0 border-r border-[var(--fintheon-accent)]/15 overflow-y-auto p-3">
            <RoutinesConsole />

            <div className="border-t border-[var(--fintheon-accent)]/15 my-4" />

            <RegimeControl regime={regime} onRegimeChanged={fetchRegime} />

            {v4Available ? (
              <>
                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 12,
                    borderTop: "1px solid var(--fintheon-glass-border)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 10,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--fintheon-muted)",
                      marginBottom: 6,
                    }}
                  >
                    Group Sensitivity
                  </div>
                  {GROUPS.map((g) => (
                    <GroupSensitivityDial
                      key={g}
                      group={g}
                      value={pendingSensitivities[g]}
                      onChange={onDialChange}
                    />
                  ))}
                </div>

                <PresetSelector
                  presets={presets}
                  selectedId={selectedPresetId}
                  onSelect={onPresetSelect}
                  onSaveCurrent={onSavePreset}
                />

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
                  padding: "10px 12px",
                  border: "1px dashed var(--fintheon-glass-border)",
                  borderRadius: 4,
                  fontSize: 11,
                  color: "var(--fintheon-muted)",
                  fontFamily: "var(--font-data)",
                  letterSpacing: "0.04em",
                  lineHeight: 1.5,
                }}
              >
                V4 preset API not yet available — group dials land with T3.
                Advanced per-event controls still work.
              </div>
            )}

            <AdvancedPane
              count={weights.length + registry.length + sourceAccounts.length}
            >
              <MatrixEditor />
              <div
                style={{ borderTop: "1px solid var(--fintheon-glass-border)" }}
              />
              <LexiconEditor />
              <div
                style={{ borderTop: "1px solid var(--fintheon-glass-border)" }}
              />
              <QuickWeightEditor
                weights={weights}
                onWeightsSaved={fetchWeights}
              />
              <div
                style={{ borderTop: "1px solid var(--fintheon-glass-border)" }}
              />
              <CommentatorManager
                registry={registry}
                onRegistryChanged={fetchRegistry}
              />
              <div
                style={{ borderTop: "1px solid var(--fintheon-glass-border)" }}
              />
              <SourceAccountsManager
                accounts={sourceAccounts}
                onAccountsChanged={fetchSourceAccounts}
              />
            </AdvancedPane>
          </div>

          {/* Right panel — annotatable feed */}
          <div className="flex-1 min-w-0 overflow-y-auto p-3 space-y-2">
            <div className="text-[10px] text-zinc-500 mb-1">
              {items.length} item{items.length !== 1 ? "s" : ""} in feed
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
