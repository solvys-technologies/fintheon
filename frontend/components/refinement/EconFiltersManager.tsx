// [claude-code 2026-04-25] S38: Body text bumped one tier (text-[10px] → text-[12px], text-[9px] → text-[11px]) for legibility on the Refinement Engine surface.
// [claude-code 2026-04-24] S34-T1: Econ filters manager — CRUD UI for the
// country × category grid that drives which econ events the populator watches.
// Mirrors SourceAccountsManager layout. Accent-border flat rows only; no
// glass/gradient/emoji per S34 banned ornaments + feedback_no_glass_effects.
import { useState, useCallback } from "react";
import {
  CalendarClock,
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  Power,
} from "lucide-react";
import type {
  EconWatchCategory,
  EconWatchCountry,
  EconWatchFilter,
} from "../../../backend-hono/src/types/econ-watch-filter";
import {
  ECON_WATCH_CATEGORIES,
  ECON_WATCH_COUNTRIES,
} from "../../../backend-hono/src/types/econ-watch-filter";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

interface EconFiltersManagerProps {
  filters: EconWatchFilter[];
  onFiltersChanged: () => void;
}

// Category chip palette — exact assignment from S34-T1 brief:
// Fiscal → warm gold, Inflation → muted amber, Supply Chain → neutral, Job Market → slate.
const CATEGORY_BADGE: Record<EconWatchCategory, { color: string }> = {
  Fiscal: {
    color: "text-[var(--fintheon-accent)] border-[var(--fintheon-accent)]/30",
  },
  Inflation: { color: "text-amber-400/80 border-amber-400/20" },
  "Supply Chain": { color: "text-zinc-400 border-zinc-500/30" },
  "Job Market": { color: "text-slate-400 border-slate-500/30" },
};

const CATEGORY_ORDER: EconWatchCategory[] = [
  "Fiscal",
  "Inflation",
  "Supply Chain",
  "Job Market",
];

export function EconFiltersManager({
  filters,
  onFiltersChanged,
}: EconFiltersManagerProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [addCountry, setAddCountry] = useState<EconWatchCountry>("US");
  const [addCategory, setAddCategory] = useState<EconWatchCategory>("Fiscal");
  const [addSubmitting, setAddSubmitting] = useState(false);

  const sorted = [...filters].sort((a, b) => {
    const aCountry = a.country as EconWatchCountry;
    const bCountry = b.country as EconWatchCountry;
    const ci = ECON_WATCH_COUNTRIES.indexOf(aCountry);
    const cj = ECON_WATCH_COUNTRIES.indexOf(bCountry);
    if (ci !== cj) return ci - cj;
    const ai = CATEGORY_ORDER.indexOf(a.category as EconWatchCategory);
    const bi = CATEGORY_ORDER.indexOf(b.category as EconWatchCategory);
    return ai - bi;
  });

  const activeCount = filters.filter((f) => f.active).length;

  const handleAdd = useCallback(async () => {
    setAddSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/econ-filters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: addCountry,
          category: addCategory,
          active: true,
        }),
      });
      setShowAdd(false);
      onFiltersChanged();
    } catch (err) {
      console.error("[EconFiltersManager] Add failed:", err);
    } finally {
      setAddSubmitting(false);
    }
  }, [addCountry, addCategory, onFiltersChanged]);

  const handleToggleActive = useCallback(
    async (id: string, currentActive: boolean) => {
      try {
        await fetch(`${API_BASE}/api/econ-filters/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !currentActive }),
        });
        onFiltersChanged();
      } catch (err) {
        console.error("[EconFiltersManager] Toggle failed:", err);
      }
    },
    [onFiltersChanged],
  );

  const handleRemove = useCallback(
    async (id: string) => {
      try {
        await fetch(`${API_BASE}/api/econ-filters/${id}`, {
          method: "DELETE",
        });
        onFiltersChanged();
      } catch (err) {
        console.error("[EconFiltersManager] Remove failed:", err);
      }
    },
    [onFiltersChanged],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--fintheon-text)]/70 uppercase tracking-wider">
          <CalendarClock className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          Econ Watch Filters
        </div>
        <span className="text-[11px] text-zinc-600">
          {activeCount}/{filters.length} active
        </span>
      </div>

      {/* Filter list */}
      <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
        {sorted.map((filter) => {
          const badge =
            CATEGORY_BADGE[filter.category as EconWatchCategory] ??
            CATEGORY_BADGE.Fiscal;
          return (
            <div
              key={filter.id}
              className={`flex items-center gap-1.5 px-1.5 py-1 rounded group transition-colors hover:bg-zinc-800/30 ${
                !filter.active ? "opacity-40" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-[var(--fintheon-text)] truncate">
                  {filter.country}
                </div>
              </div>
              <span
                className={`text-[8px] font-bold px-1 py-px rounded border shrink-0 ${badge.color}`}
              >
                {filter.category}
              </span>
              <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => handleToggleActive(filter.id, filter.active)}
                  className={`p-0.5 transition-colors ${
                    filter.active
                      ? "text-emerald-500 hover:text-zinc-400"
                      : "text-zinc-600 hover:text-emerald-400"
                  }`}
                  title={filter.active ? "Deactivate" : "Activate"}
                >
                  <Power className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={() => handleRemove(filter.id)}
                  className="p-0.5 text-zinc-600 hover:text-red-400 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="text-[12px] text-zinc-600 text-center py-4">
            No econ filters configured.
          </div>
        )}
      </div>

      {/* Add form toggle */}
      <button
        onClick={() => setShowAdd(!showAdd)}
        className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
      >
        <Plus className="w-3 h-3" />
        Add Filter
        {showAdd ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {showAdd && (
        <div className="space-y-1.5 p-2 rounded border border-zinc-800 bg-zinc-900/50">
          <div className="flex gap-1.5">
            <select
              value={addCountry}
              onChange={(e) =>
                setAddCountry(e.target.value as EconWatchCountry)
              }
              className="flex-1 bg-transparent border border-zinc-700 rounded px-1.5 py-1 text-[12px] text-[var(--fintheon-text)] outline-none"
            >
              {ECON_WATCH_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={addCategory}
              onChange={(e) =>
                setAddCategory(e.target.value as EconWatchCategory)
              }
              className="flex-1 bg-transparent border border-zinc-700 rounded px-1.5 py-1 text-[12px] text-zinc-300 outline-none"
            >
              {ECON_WATCH_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={addSubmitting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--fintheon-accent)]/30 text-[12px] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {addSubmitting ? "Adding..." : "Add Filter"}
          </button>
        </div>
      )}
    </div>
  );
}
