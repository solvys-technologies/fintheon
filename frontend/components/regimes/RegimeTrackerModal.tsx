// [claude-code 2026-03-06] Full Regime Tracker modal — grouped by category, W-L tracking, add custom regimes
// [claude-code 2026-05-16] DEPRECATED — regime tracker replaced by theme-tracker (S68-T1). Kept for backward compat.
// [claude-code 2026-03-12] Replaced W/L with ORB bullish/bearish, AI generate CTA, delete all regimes, 12H NY time, collapsed active regimes, labeled ORB record
// [claude-code 2026-04-15] T2: Decomposed into subcomponents, liquid glass shell, 5 bias classifications, removed footer border
// [claude-code 2026-04-15] T3: Glassmorphic AI generate overlay, thinking animation, mini-chat passthrough
import { useState, useMemo } from "react";
import { X, Plus, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { useRegimes } from "../../lib/regime-store";
import {
  isRegimeActive,
  getTimeRemaining,
  getCurrentETTime,
} from "../../lib/regime-time";
import type { TradingRegime, TimeWindow } from "../../lib/regimes";
import { BiasBadge } from "./BiasBadge";
import { ConfidenceBar } from "./ConfidenceBar";
import { RegimeCard } from "./RegimeCard";
import { RegimeThinkingOverlay } from "./RegimeThinkingOverlay";

const CATEGORY_LABELS: Record<TradingRegime["category"], string> = {
  institutional: "Institutional",
  session: "Session",
  report: "Report",
  custom: "Custom",
};

const CATEGORY_ORDER: TradingRegime["category"][] = [
  "institutional",
  "session",
  "report",
  "custom",
];

// [claude-code 2026-04-16] Solvys Feels restyle: flat surfaces, accent borders, schedule type pills, multi-window support
const SCHEDULE_TYPES = ["static", "dynamic", "mixed"] as const;
type ScheduleType = (typeof SCHEDULE_TYPES)[number];
const SCHEDULE_LABELS: Record<ScheduleType, string> = {
  static: "Static",
  dynamic: "Dynamic",
  mixed: "Mixed",
};
const SCHEDULE_HINTS: Record<ScheduleType, string> = {
  static: "Fixed recurring window every week",
  dynamic: "Specific day + time blocks you define",
  mixed: "Recurring base + additional one-off windows",
};
const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function AddRegimeForm({
  onAdd,
  onCancel,
}: {
  onAdd: (r: TradingRegime) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [bias, setBias] = useState<TradingRegime["bias"]>("consolidation");
  const [confidence, setConfidence] = useState(50);
  const [instruments, setInstruments] = useState("/NQ, /ES");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("static");
  const [timeWindows, setTimeWindows] = useState<TimeWindow[]>([]);

  const addWindow = () =>
    setTimeWindows((prev) => [
      ...prev,
      { day: "Mon", start: "09:30", end: "11:00" },
    ]);
  const removeWindow = (idx: number) =>
    setTimeWindows((prev) => prev.filter((_, i) => i !== idx));
  const updateWindow = (idx: number, field: keyof TimeWindow, val: string) =>
    setTimeWindows((prev) =>
      prev.map((w, i) => (i === idx ? { ...w, [field]: val } : w)),
    );

  const handleSubmit = () => {
    if (!name.trim()) return;
    const regime: TradingRegime = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      category: "custom",
      timeRange: { start: startTime, end: endTime },
      timezone: "ET",
      daysActive: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      scheduleType,
      timeWindows: timeWindows.length > 0 ? timeWindows : undefined,
      confidence,
      record: { bullishDays: 0, bearishDays: 0 },
      daysObserved: 0,
      bias,
      instruments: instruments
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    onAdd(regime);
  };

  const inputClass =
    "w-full rounded-md bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/10 text-xs text-[var(--fintheon-text)] px-3 py-2 focus:outline-none focus:border-[var(--fintheon-accent)]/40 transition-colors appearance-none";
  const labelClass =
    "text-[9px] text-[var(--fintheon-text)]/40 uppercase tracking-wider font-medium";

  return (
    <div className="rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#0a0905]">
      <div className="px-4 py-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fintheon-accent)]/70">
            New Regime
          </span>
          <button
            onClick={onCancel}
            className="p-1 text-[var(--fintheon-text)]/20 hover:text-[var(--fintheon-text)]/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <input
          className={inputClass}
          placeholder="Regime name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <input
          className={inputClass}
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Schedule type pills */}
        <div className="space-y-1.5">
          <span className={labelClass}>Schedule</span>
          <div className="flex items-center gap-1">
            {SCHEDULE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setScheduleType(t)}
                className={`rounded-md px-3 py-1 text-[10px] font-medium transition-colors ${
                  scheduleType === t
                    ? "bg-[var(--fintheon-accent)]/12 text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30"
                    : "text-[var(--fintheon-text)]/30 border border-transparent hover:text-[var(--fintheon-text)]/60"
                }`}
              >
                {SCHEDULE_LABELS[t]}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-[var(--fintheon-text)]/20">
            {SCHEDULE_HINTS[scheduleType]}
          </p>
        </div>

        {/* Primary time range (static + mixed) */}
        {(scheduleType === "static" || scheduleType === "mixed") && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelClass}>Start (ET)</label>
              <input
                className={inputClass}
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>End (ET)</label>
              <input
                className={inputClass}
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Dynamic time windows (dynamic + mixed) */}
        {(scheduleType === "dynamic" || scheduleType === "mixed") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={labelClass}>Time Blocks</span>
              <button
                onClick={addWindow}
                className="p-1 text-[var(--fintheon-accent)]/40 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 rounded-md transition-all"
                title="Add time block"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {timeWindows.length === 0 && (
              <p className="text-[9px] text-[var(--fintheon-text)]/20 py-1">
                No blocks yet. Click + to add a day/time window.
              </p>
            )}
            {timeWindows.map((w, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="space-y-1 w-20">
                  {idx === 0 && <label className={labelClass}>Day</label>}
                  <select
                    className={inputClass}
                    value={w.day}
                    onChange={(e) => updateWindow(idx, "day", e.target.value)}
                    style={{ colorScheme: "dark" }}
                  >
                    {ALL_DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 flex-1">
                  {idx === 0 && <label className={labelClass}>Start</label>}
                  <input
                    className={inputClass}
                    type="time"
                    value={w.start}
                    onChange={(e) => updateWindow(idx, "start", e.target.value)}
                  />
                </div>
                <div className="space-y-1 flex-1">
                  {idx === 0 && <label className={labelClass}>End</label>}
                  <input
                    className={inputClass}
                    type="time"
                    value={w.end}
                    onChange={(e) => updateWindow(idx, "end", e.target.value)}
                  />
                </div>
                <button
                  onClick={() => removeWindow(idx)}
                  className="p-1.5 text-[var(--fintheon-text)]/20 hover:text-red-400/60 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Bias + Confidence */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className={labelClass}>Bias</label>
            <select
              className={inputClass}
              value={bias}
              onChange={(e) => setBias(e.target.value as TradingRegime["bias"])}
              style={{ colorScheme: "dark" }}
            >
              <option value="continuation">Continuation</option>
              <option value="reversal">Reversal</option>
              <option value="convergence">Convergence</option>
              <option value="consolidation">Consolidation</option>
              <option value="rotation">Rotation</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Confidence</label>
            <input
              className={inputClass}
              type="number"
              min={0}
              max={100}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Live preview */}
        <div className="flex items-center gap-3">
          <BiasBadge bias={bias} />
          <ConfidenceBar value={confidence} />
        </div>

        <input
          className={inputClass}
          placeholder="Instruments (comma-separated)"
          value={instruments}
          onChange={(e) => setInstruments(e.target.value)}
        />

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="rounded-md px-4 py-1.5 text-[10px] font-semibold bg-[var(--fintheon-accent)] text-[var(--fintheon-bg)] transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
          >
            Add Regime
          </button>
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-[10px] text-[var(--fintheon-text)]/40 hover:text-[var(--fintheon-text)]/70 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface RegimeTrackerModalProps {
  onClose: () => void;
}

export function RegimeTrackerModal({ onClose }: RegimeTrackerModalProps) {
  const { regimes, addRegime, recordBullish, recordBearish, deleteRegime } =
    useRegimes();
  const [showAddForm, setShowAddForm] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const now = getCurrentETTime();

  const grouped = useMemo(() => {
    const map = new Map<TradingRegime["category"], TradingRegime[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const r of regimes) {
      const list = map.get(r.category) ?? [];
      list.push(r);
      map.set(r.category, list);
    }
    return map;
  }, [regimes]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  /** AI Generate — show thinking overlay, dispatch to chat */
  const handleAIGenerate = () => {
    setShowThinking(true);
    setIsGenerating(true);
    window.dispatchEvent(
      new CustomEvent("fintheon:open-chat-skill", {
        detail: {
          skillId: "regimes",
          prompt: "Create a new trading regime for me",
        },
      }),
    );
    // Simulated generation time — overlay exits after 4s
    setTimeout(() => setIsGenerating(false), 4000);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-2xl rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#0a0905] flex flex-col max-h-[85vh] overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--fintheon-accent)]/20 shrink-0">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--fintheon-accent)]" />
              <h2 className="text-sm font-bold text-[var(--fintheon-accent)]">
                Regime Tracker
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAIGenerate}
                className="rounded-md px-3 py-1 text-[10px] font-semibold bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/20 hover:bg-[var(--fintheon-accent)]/15 hover:border-[var(--fintheon-accent)]/35 transition-colors"
              >
                AI Generate
              </button>
              <button
                onClick={() => setShowAddForm((v) => !v)}
                className="p-1.5 text-[var(--fintheon-accent)]/40 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 rounded-md transition-all"
                title="Add regime manually"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1 text-zinc-500 hover:text-[var(--fintheon-text)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Thinking overlay */}
          <RegimeThinkingOverlay
            isVisible={showThinking}
            isGenerating={isGenerating}
            onComplete={() => setShowThinking(false)}
          />

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            <div
              className={
                showThinking
                  ? "opacity-30 transition-opacity duration-300"
                  : "transition-opacity duration-300"
              }
            >
              {showAddForm && (
                <AddRegimeForm
                  onAdd={(r) => {
                    addRegime(r);
                    setShowAddForm(false);
                  }}
                  onCancel={() => setShowAddForm(false)}
                />
              )}
            </div>

            {CATEGORY_ORDER.map((cat) => {
              const items = grouped.get(cat) ?? [];
              if (items.length === 0 && cat !== "custom") return null;
              const isCollapsed = collapsedCategories.has(cat);
              const activeItems = items.filter((r) => isRegimeActive(r, now));

              return (
                <div key={cat}>
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="flex items-center gap-2 mb-2 group w-full text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3 text-[var(--fintheon-accent)]/60" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-[var(--fintheon-accent)]/60" />
                    )}
                    <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[var(--fintheon-accent)]">
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span className="text-[9px] text-zinc-600">
                      {items.length} regime{items.length !== 1 ? "s" : ""}
                    </span>
                    {activeItems.length > 0 && (
                      <span className="text-[9px] font-bold text-[var(--fintheon-accent)]">
                        {activeItems.length} active
                      </span>
                    )}
                  </button>

                  {/* Always show active regimes even when collapsed */}
                  {isCollapsed && activeItems.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {activeItems.map((r) => (
                        <RegimeCard
                          key={r.id}
                          regime={r}
                          isActive
                          timeInfo={getTimeRemaining(r, now)}
                          onRecordBullish={() => recordBullish(r.id)}
                          onRecordBearish={() => recordBearish(r.id)}
                          onDelete={() => deleteRegime(r.id)}
                          onExpandToSidebar={onClose}
                        />
                      ))}
                    </div>
                  )}

                  {/* Full list when expanded */}
                  {!isCollapsed && (
                    <div className="space-y-2">
                      {items.length === 0 ? (
                        <div className="text-[10px] text-zinc-600 pl-5">
                          No custom regimes yet
                        </div>
                      ) : (
                        items.map((r) => (
                          <RegimeCard
                            key={r.id}
                            regime={r}
                            isActive={isRegimeActive(r, now)}
                            timeInfo={getTimeRemaining(r, now)}
                            onRecordBullish={() => recordBullish(r.id)}
                            onRecordBearish={() => recordBearish(r.id)}
                            onDelete={() => deleteRegime(r.id)}
                            onExpandToSidebar={onClose}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer — no border, subtle separator */}
          <div className="shrink-0">
            <div className="h-px bg-[var(--fintheon-accent)]/5" />
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-[9px] text-zinc-700 tracking-wider uppercase">
                {regimes.length} regimes |{" "}
                {regimes.filter((r) => isRegimeActive(r, now)).length} active
              </span>
              <span className="text-[9px] text-zinc-700">
                All times New York (ET)
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
