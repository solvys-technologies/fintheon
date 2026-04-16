// [claude-code 2026-03-06] Full Regime Tracker modal — grouped by category, W-L tracking, add custom regimes
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
import type { TradingRegime } from "../../lib/regimes";
import { GlassEffect, GlassButton } from "../ui/liquid-glass";
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
    "w-full bg-[#0a0a06]/60 border border-zinc-800/60 text-xs text-[var(--fintheon-text)] px-2.5 py-1.5 focus:outline-none focus:border-[var(--fintheon-accent)]/40 transition-colors";

  return (
    <GlassEffect
      className="rounded-2xl"
      style={{
        borderColor: "var(--fintheon-accent)",
        boxShadow: "0 0 16px rgba(212,175,55,0.12)",
      }}
    >
      <div className="px-4 py-3 space-y-2.5">
        {/* Header — matches RegimeCard header style */}
        <div className="flex items-start justify-between mb-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--fintheon-accent)]">
                New Regime
              </span>
              <span className="shrink-0 inline-flex items-center gap-1 text-[8px] font-bold tracking-wider uppercase text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10 px-1.5 py-0.5">
                <Plus className="w-2 h-2" />
                CREATE
              </span>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 p-1 text-zinc-700 hover:text-zinc-400 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Form fields */}
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

        {/* Meta row — matches RegimeCard meta layout */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-zinc-600 uppercase tracking-wider">
              Start (NY)
            </label>
            <input
              className={inputClass}
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[9px] text-zinc-600 uppercase tracking-wider">
              End (NY)
            </label>
            <input
              className={inputClass}
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        {/* Bias + Confidence — inline with visual preview */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-zinc-600 uppercase tracking-wider">
              Bias
            </label>
            <select
              className={inputClass}
              value={bias}
              onChange={(e) => setBias(e.target.value as TradingRegime["bias"])}
            >
              <option value="continuation">Continuation</option>
              <option value="reversal">Reversal</option>
              <option value="convergence">Convergence</option>
              <option value="consolidation">Consolidation</option>
              <option value="rotation">Rotation</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] text-zinc-600 uppercase tracking-wider">
              Confidence
            </label>
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

        {/* Live preview badges */}
        <div className="flex items-center gap-3">
          <BiasBadge bias={bias} />
          <ConfidenceBar value={confidence} />
        </div>

        <input
          className={inputClass}
          placeholder="Instruments (comma-sep)"
          value={instruments}
          onChange={(e) => setInstruments(e.target.value)}
        />

        {/* Actions */}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-3 py-1 text-[10px] font-semibold bg-[var(--fintheon-accent)] text-black hover:bg-[color-mix(in_srgb,var(--fintheon-accent)_80%,white)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Add Regime
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </GlassEffect>
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
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <GlassEffect
          tint="rgba(5,4,2,0.88)"
          blur={16}
          className="pointer-events-auto w-full max-w-2xl rounded-2xl shadow-[0_0_40px_rgba(199,159,74,0.15)] flex flex-col max-h-[85vh] overflow-hidden relative"
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
              <GlassButton
                onClick={handleAIGenerate}
                className="px-2 py-1 text-[10px] font-semibold"
              >
                AI Generate
              </GlassButton>
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
        </GlassEffect>
      </div>
    </>
  );
}
