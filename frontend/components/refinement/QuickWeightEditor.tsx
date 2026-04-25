// [claude-code 2026-04-25] S38: Nothing-style sliders — tick increments above the track,
//   solid accent active fill (no gradients), endpoint dots, Inter-Mono drag-value popover.
//   Snap-to-tick on release; free-drag between.
// [claude-code 2026-03-27] S2-T7: Quick weight editor — compact sliders for event type weights
import { useState, useEffect, useCallback } from "react";
import { SlidersHorizontal, Save, ChevronDown, ChevronUp } from "lucide-react";
import type { CalibrationEntry } from "../../../backend-hono/src/types/calibration";

const TICK_VALUES = [0, 2.5, 5, 7.5, 10] as const;
const SNAP_STEP = 1;

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

interface QuickWeightEditorProps {
  weights: CalibrationEntry[];
  onWeightsSaved: () => void;
}

const TOP_COUNT = 10;

export function QuickWeightEditor({
  weights,
  onWeightsSaved,
}: QuickWeightEditorProps) {
  const [localWeights, setLocalWeights] = useState<Record<string, number>>({});
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState("");

  // Seed local state from props
  useEffect(() => {
    const map: Record<string, number> = {};
    for (const w of weights) {
      map[w.eventType] = w.baseWeight;
    }
    setLocalWeights(map);
  }, [weights]);

  const handleSliderChange = useCallback((eventType: string, value: number) => {
    setLocalWeights((prev) => ({ ...prev, [eventType]: value }));
  }, []);

  const changedTypes = weights.filter(
    (w) =>
      localWeights[w.eventType] !== undefined &&
      localWeights[w.eventType] !== w.baseWeight,
  );

  const handleSave = async () => {
    if (changedTypes.length === 0) return;
    setSaving(true);
    try {
      for (const w of changedTypes) {
        await fetch(
          `${API_BASE}/api/calibration/weight/${encodeURIComponent(w.eventType)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ baseWeight: localWeights[w.eventType] }),
          },
        ).then((r) => r.json());
      }
      setHint("Weights saved \u2014 Re-Score All to apply");
      onWeightsSaved();
    } catch (err) {
      console.error("[QuickWeightEditor] Save failed:", err);
      setHint("Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Clear hint after 8 seconds
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(""), 8000);
    return () => clearTimeout(t);
  }, [hint]);

  const sorted = [...weights].sort((a, b) => b.baseWeight - a.baseWeight);
  const visible = showAll ? sorted : sorted.slice(0, TOP_COUNT);
  const hasMore = sorted.length > TOP_COUNT;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--fintheon-text)]/70 uppercase tracking-wider">
        <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
        Event Weights
      </div>

      <div className="space-y-3">
        {visible.map((w) => {
          const value = localWeights[w.eventType] ?? w.baseWeight;
          const isChanged = value !== w.baseWeight;
          return (
            <NothingWeightSlider
              key={w.eventType}
              eventType={w.eventType}
              value={value}
              isChanged={isChanged}
              onChange={(v) => handleSliderChange(w.eventType, v)}
            />
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
        >
          {showAll ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          {showAll ? "Show Less" : `Show All (${sorted.length})`}
        </button>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={changedTypes.length === 0 || saving}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--fintheon-accent)]/30 text-[10px] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Save className="w-3 h-3" />
        {saving
          ? "Saving..."
          : `Save${changedTypes.length > 0 ? ` (${changedTypes.length})` : ""}`}
      </button>

      {hint && (
        <div className="text-[9px] text-[var(--fintheon-accent)]/80 animate-pulse">
          {hint}
        </div>
      )}
    </div>
  );
}

interface NothingWeightSliderProps {
  eventType: string;
  value: number;
  isChanged: boolean;
  onChange: (next: number) => void;
}

function NothingWeightSlider({
  eventType,
  value,
  isChanged,
  onChange,
}: NothingWeightSliderProps) {
  const [dragging, setDragging] = useState(false);
  const pct = Math.max(0, Math.min(100, (value / 10) * 100));

  const handleRelease = useCallback(() => {
    setDragging(false);
    const snapped = Math.round(value / SNAP_STEP) * SNAP_STEP;
    if (snapped !== value) onChange(snapped);
  }, [value, onChange]);

  return (
    <div className="flex items-center gap-2">
      <span
        className={`text-[9px] w-20 truncate ${isChanged ? "text-[var(--fintheon-accent)]" : "text-zinc-500"}`}
        title={eventType}
      >
        {eventType}
      </span>
      <div className="relative flex-1 h-6 flex items-center">
        {/* Tick marks above the track */}
        <div className="absolute inset-x-0 top-0.5 h-1.5 pointer-events-none">
          {TICK_VALUES.map((t) => (
            <span
              key={t}
              aria-hidden="true"
              className="absolute top-0 w-px h-1.5 bg-[var(--fintheon-text)]/40"
              style={{ left: `${(t / 10) * 100}%` }}
            />
          ))}
        </div>
        {/* Endpoint dots */}
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[var(--fintheon-accent)]/70"
        />
        <span
          aria-hidden="true"
          className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[var(--fintheon-accent)]/70"
        />
        {/* Solid accent active fill (no gradient) */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-[var(--fintheon-text)]/15 rounded-sm">
          <div
            className="h-full bg-[var(--fintheon-accent)] rounded-sm"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Native input drives a11y + keyboard; rendered transparent on top of the visual track */}
        <input
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onMouseDown={() => setDragging(true)}
          onTouchStart={() => setDragging(true)}
          onMouseUp={handleRelease}
          onTouchEnd={handleRelease}
          onKeyUp={handleRelease}
          aria-label={`${eventType} weight`}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        {/* Drag-value popover — Inter Mono, only while dragging */}
        {dragging && (
          <span
            aria-hidden="true"
            className="absolute -top-3.5 -translate-x-1/2 px-1 text-[9px] text-[var(--fintheon-accent)] bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/30 rounded-sm tabular-nums"
            style={{
              left: `${pct}%`,
              fontFamily:
                "var(--font-data, ui-monospace), ui-monospace, monospace",
            }}
          >
            {value.toFixed(1)}
          </span>
        )}
      </div>
      <span
        className={`text-[9px] w-6 text-right font-mono ${isChanged ? "text-[var(--fintheon-accent)]" : "text-zinc-500"}`}
      >
        {value.toFixed(1)}
      </span>
    </div>
  );
}
