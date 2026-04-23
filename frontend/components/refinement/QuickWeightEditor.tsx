// [claude-code 2026-03-27] S2-T7: Quick weight editor — compact sliders for event type weights
import { useState, useEffect, useCallback } from "react";
import {
  SlidersHorizontal,
  Save,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { CalibrationEntry } from "../../../backend-hono/src/types/calibration";

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

      <div className="space-y-1.5">
        {visible.map((w) => {
          const value = localWeights[w.eventType] ?? w.baseWeight;
          const isChanged = value !== w.baseWeight;
          return (
            <div key={w.eventType} className="flex items-center gap-2">
              <span
                className={`text-[9px] w-20 truncate ${isChanged ? "text-[var(--fintheon-accent)]" : "text-zinc-500"}`}
                title={w.eventType}
              >
                {w.eventType}
              </span>
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={value}
                onChange={(e) =>
                  handleSliderChange(w.eventType, parseFloat(e.target.value))
                }
                className="flex-1 h-1 accent-[var(--fintheon-accent)] cursor-pointer"
              />
              <span
                className={`text-[9px] w-6 text-right font-mono ${isChanged ? "text-[var(--fintheon-accent)]" : "text-zinc-500"}`}
              >
                {value.toFixed(1)}
              </span>
            </div>
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
