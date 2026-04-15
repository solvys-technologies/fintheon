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
    "w-full bg-[#0a0a06] border border-zinc-800 text-xs text-[var(--fintheon-text)] px-2 py-1.5 focus:outline-none focus:border-[var(--fintheon-accent)]/40";

  return (
    <div className="bg-[#0a0a06] border border-[var(--fintheon-accent)]/30 p-3 space-y-2">
      <div className="text-[10px] font-semibold text-[var(--fintheon-accent)] tracking-wider uppercase mb-1">
        New Custom Regime
      </div>
      <input
        className={inputClass}
        placeholder="Regime name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className={inputClass}
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-zinc-600 uppercase">
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
          <label className="text-[9px] text-zinc-600 uppercase">End (NY)</label>
          <input
            className={inputClass}
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-zinc-600 uppercase">Bias</label>
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
          <label className="text-[9px] text-zinc-600 uppercase">
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
      <input
        className={inputClass}
        placeholder="Instruments (comma-sep)"
        value={instruments}
        onChange={(e) => setInstruments(e.target.value)}
      />
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSubmit}
          className="px-3 py-1 text-[10px] font-semibold bg-[var(--fintheon-accent)] text-black hover:bg-[color-mix(in_srgb,var(--fintheon-accent)_80%,white)] transition-colors"
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
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800/50 transition-colors"
              >
                <Plus className="w-3 h-3" /> Manual
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
