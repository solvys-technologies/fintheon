// [claude-code 2026-03-16] NarrativeTimelineModal — scrollable vertical timeline with electric pulse
import { useState, useCallback, useMemo } from "react";
import { X, Plus } from "@/components/shared/iso-icons";
import { useNarrative } from "../../contexts/NarrativeContext";
import type {
  CatalystCard,
  NarrativeCategory,
} from "../../lib/narrative-types";

const CATEGORIES: { value: NarrativeCategory; label: string }[] = [
  { value: "geopolitical", label: "Geopolitical" },
  { value: "macroeconomic", label: "Macroeconomic" },
  { value: "monetary", label: "Monetary" },
  { value: "market-structure", label: "Market Structure" },
  { value: "supply-chain", label: "Supply Chain" },
  { value: "black-swan", label: "Black Swan" },
  { value: "earnings", label: "Earnings" },
];

interface NarrativeTimelineModalProps {
  open: boolean;
  onClose: () => void;
}

export function NarrativeTimelineModal({
  open,
  onClose,
}: NarrativeTimelineModalProps) {
  const { state, dispatch } = useNarrative();
  const [tagInput, setTagInput] = useState<Record<string, string>>({});
  const [isClosing, setIsClosing] = useState(false);

  const sorted = useMemo(
    () =>
      [...state.catalysts].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [state.catalysts],
  );

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 250);
  }, [onClose]);

  const updateCatalyst = useCallback(
    (id: string, updates: Partial<CatalystCard>) => {
      dispatch({ type: "UPDATE_CATALYST", id, updates });
    },
    [dispatch],
  );

  const addTag = useCallback(
    (catalystId: string) => {
      const raw = tagInput[catalystId]?.trim();
      if (!raw) return;
      const catalyst = state.catalysts.find((c) => c.id === catalystId);
      if (!catalyst) return;
      const existing = catalyst.tags ?? [];
      if (!existing.includes(raw)) {
        dispatch({
          type: "TAG_CATALYST",
          catalystId,
          tags: [...existing, raw],
        });
      }
      setTagInput((prev) => ({ ...prev, [catalystId]: "" }));
    },
    [tagInput, state.catalysts, dispatch],
  );

  const removeTag = useCallback(
    (catalystId: string, tag: string) => {
      const catalyst = state.catalysts.find((c) => c.id === catalystId);
      if (!catalyst) return;
      dispatch({
        type: "TAG_CATALYST",
        catalystId,
        tags: (catalyst.tags ?? []).filter((t) => t !== tag),
      });
    },
    [state.catalysts, dispatch],
  );

  const addNewEvent = useCallback(() => {
    dispatch({
      type: "ADD_CATALYST",
      catalyst: {
        title: "New Event",
        description: "",
        date: new Date().toISOString().slice(0, 10),
        sentiment: "bullish",
        severity: "medium",
        source: "user",
        narrativeIds: [],
        isGhost: false,
        templateType: null,
        position: null,
        tags: [],
        drillDepth: 0,
      },
    });
  }, [dispatch]);

  if (!open && !isClosing) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm ${
        isClosing ? "animate-fade-out-backdrop" : "animate-fade-in-backdrop"
      }`}
      onClick={handleClose}
    >
      <div
        className={`w-full max-w-xl max-h-[80vh] flex flex-col rounded-lg border shadow-[0_0_40px_rgba(199,159,74,0.12)] ${
          isClosing ? "animate-fade-out" : "animate-fade-in"
        }`}
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--fintheon-surface) 90%, transparent)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderColor:
            "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <h2
            className="text-sm font-bold"
            style={{ color: "var(--fintheon-accent)" }}
          >
            Narrative Timeline
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-white/5 rounded transition-all"
          >
            <X className="w-4 h-4" style={{ color: "var(--fintheon-muted)" }} />
          </button>
        </div>

        {/* Timeline body */}
        <div className="flex-1 overflow-y-auto py-4 px-4">
          <div className="relative pl-8">
            {/* Vertical timeline line with electric pulse */}
            <div
              className="timeline-line absolute left-3 top-0 bottom-0 w-[2px]"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--fintheon-accent) 30%, transparent)",
              }}
            />

            {sorted.length === 0 && (
              <p
                className="text-center text-xs py-8 ml-4"
                style={{ color: "var(--fintheon-muted)" }}
              >
                No narrative events yet. Add one below.
              </p>
            )}

            {sorted.map((catalyst) => (
              <div key={catalyst.id} className="relative mb-4">
                {/* Dot on timeline */}
                <div
                  className="absolute left-[-21px] top-3 w-2.5 h-2.5 rounded-full border-2 z-10"
                  style={{
                    backgroundColor:
                      catalyst.sentiment === "bullish"
                        ? "var(--fintheon-bullish)"
                        : "var(--fintheon-bearish)",
                    borderColor: "var(--fintheon-surface)",
                  }}
                />
                {/* Horizontal connector */}
                <div
                  className="absolute left-[-10px] top-[18px] w-[18px] h-[2px]"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--fintheon-accent) 30%, transparent)",
                  }}
                />

                {/* Card */}
                <div
                  className="ml-2 rounded-md border p-3 flex flex-col gap-2"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--fintheon-surface) 80%, transparent)",
                    borderColor:
                      "color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
                  }}
                >
                  {/* Title */}
                  <input
                    value={catalyst.title}
                    onChange={(e) =>
                      updateCatalyst(catalyst.id, { title: e.target.value })
                    }
                    className="text-xs font-semibold bg-transparent outline-none w-full border-b border-transparent focus:border-current transition-colors"
                    style={{ color: "var(--fintheon-text)" }}
                  />

                  {/* Description + AI sparkle button */}
                  <div className="relative">
                    <textarea
                      value={catalyst.description}
                      onChange={(e) =>
                        updateCatalyst(catalyst.id, {
                          description: e.target.value,
                        })
                      }
                      placeholder="Describe this event..."
                      rows={2}
                      className="text-[11px] w-full bg-transparent outline-none resize-none rounded border px-2 py-1.5 pr-7"
                      style={{
                        color: "var(--fintheon-text)",
                        borderColor:
                          "color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
                      }}
                    />
                    <button
                      className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-white/10 transition-colors"
                      title="AI generate description"
                      style={{ color: "var(--fintheon-accent)" }}
                    ></button>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-1">
                    {(catalyst.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1"
                        style={{
                          color: "var(--fintheon-accent)",
                          backgroundColor:
                            "color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
                          borderColor:
                            "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
                        }}
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(catalyst.id, tag)}
                          className="opacity-50 hover:opacity-100 transition-opacity text-[8px] leading-none"
                          style={{ color: "var(--fintheon-accent)" }}
                        >
                          x
                        </button>
                      </span>
                    ))}
                    <input
                      value={tagInput[catalyst.id] ?? ""}
                      onChange={(e) =>
                        setTagInput((prev) => ({
                          ...prev,
                          [catalyst.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addTag(catalyst.id);
                      }}
                      placeholder="+ tag"
                      className="text-[9px] w-14 px-1 py-0.5 rounded border bg-transparent outline-none"
                      style={{
                        color: "var(--fintheon-text)",
                        borderColor:
                          "color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
                      }}
                    />
                  </div>

                  {/* Date + Category row */}
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={catalyst.date?.slice(0, 10) ?? ""}
                      onChange={(e) =>
                        updateCatalyst(catalyst.id, { date: e.target.value })
                      }
                      className="text-[10px] bg-transparent outline-none border rounded px-1.5 py-0.5"
                      style={{
                        color: "var(--fintheon-text)",
                        borderColor:
                          "color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
                        colorScheme: "dark",
                      }}
                    />
                    <select
                      value={catalyst.category ?? ""}
                      onChange={(e) =>
                        updateCatalyst(catalyst.id, {
                          category: (e.target.value || undefined) as
                            | NarrativeCategory
                            | undefined,
                        })
                      }
                      className="text-[10px] bg-transparent outline-none border rounded px-1.5 py-0.5 flex-1"
                      style={{
                        color: "var(--fintheon-text)",
                        borderColor:
                          "color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
                        colorScheme: "dark",
                      }}
                    >
                      <option value="">Category...</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div
          className="px-4 py-3 border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={addNewEvent}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-md border text-xs font-medium transition-all hover:bg-white/5"
            style={{
              color: "var(--fintheon-accent)",
              borderColor:
                "color-mix(in srgb, var(--fintheon-accent) 30%, transparent)",
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Narrative Event
          </button>
        </div>
      </div>
    </div>
  );
}

// Backward-compat alias used by NarrativeFlow
export { NarrativeTimelineModal as NarrativeManageModal };
