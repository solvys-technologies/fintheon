// [claude-code 2026-04-10] Sticky Bulletin — personal trade board with 4 sections
// [claude-code 2026-04-11] v2: Inline Catalyst Watch, Hot Times dropdown, Quick Clock
// [claude-code 2026-04-11] v3: Extracted hook to useStickyBulletin.ts
// [claude-code 2026-04-17] v4: Drag migrated to useDraggable hook (pointer events + rAF, grip-only)
import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ClipboardList,
  Clock,
  CalendarDays,
  StickyNote,
  Plus,
  X,
  Crosshair,
  Flame,
  ChevronDown,
  ChevronUp,
  Zap,
  GripVertical,
} from "lucide-react";
import { useStickyBulletin, DAY_LABELS } from "../hooks/useStickyBulletin";
import { useDraggable } from "../hooks/useDraggable";

interface StickyBulletinProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

const SECTIONS = [
  { id: "idea" as const, icon: Crosshair, label: "Catalyst" },
  { id: "antilag" as const, icon: Clock, label: "Antilag" },
  { id: "event" as const, icon: CalendarDays, label: "Event" },
  { id: "notes" as const, icon: StickyNote, label: "Notes" },
];

export function StickyBulletin({
  open,
  onClose,
  anchorRef,
}: StickyBulletinProps) {
  const b = useStickyBulletin(open, anchorRef);
  const gripRef = useRef<HTMLButtonElement>(null);
  const draggable = useDraggable({
    elementRef: b.panelRef,
    handleRef: gripRef,
    bounds: "viewport",
    disabled: !open,
  });

  // Reset drag transform when popup closes so next open re-anchors to the anchor button
  useEffect(() => {
    if (!open) draggable.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !b.popupPos) return null;

  const posStyle = {
    position: "fixed" as const,
    top: b.popupPos.top,
    right: b.popupPos.right,
    zIndex: 9998,
  };

  return createPortal(
    <div
      ref={b.panelRef}
      data-bulletin-panel
      style={posStyle}
      className="w-[360px] animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--fintheon-surface) 85%, transparent), color-mix(in srgb, var(--fintheon-bg) 92%, transparent))",
          backdropFilter: "blur(20px) saturate(1.3)",
          WebkitBackdropFilter: "blur(20px) saturate(1.3)",
          border:
            "1px solid color-mix(in srgb, var(--fintheon-accent) 18%, transparent)",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 color-mix(in srgb, var(--fintheon-accent) 8%, transparent)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{
            borderBottom:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 12%, transparent)",
          }}
        >
          <div className="flex items-center gap-2">
            <button
              ref={gripRef}
              className="cursor-grab active:cursor-grabbing touch-none p-0.5"
              title="Drag"
              aria-label="Drag bulletin"
            >
              <GripVertical
                className="w-3.5 h-3.5"
                style={{ color: "var(--fintheon-accent)", opacity: 0.4 }}
              />
            </button>
            <ClipboardList
              className="w-4 h-4"
              style={{ color: "var(--fintheon-accent)" }}
            />
            <span
              className="text-[12px] font-semibold tracking-[0.16em] uppercase"
              style={{ color: "var(--fintheon-accent)" }}
            >
              Bulletin
            </span>
          </div>
          <div className="flex items-center gap-1">
            {b.showQuickClock && (
              <button
                onClick={b.handleQuickClock}
                className="p-1 rounded-md hover:bg-[var(--fintheon-accent)]/10 transition-all active:scale-90"
                style={{
                  color: b.quickClockPulse
                    ? "var(--fintheon-accent)"
                    : "var(--fintheon-muted)",
                }}
                title="Quick clock antilag"
              >
                <Zap
                  className="w-3.5 h-3.5"
                  style={{
                    transform: b.quickClockPulse ? "scale(1.2)" : "scale(1)",
                    transition: "transform 0.3s ease",
                  }}
                />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-white/5 transition-colors"
              style={{ color: "var(--fintheon-muted)" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Section tabs */}
        <div
          className="flex px-2 py-1.5 gap-0.5"
          style={{
            borderBottom:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 8%, transparent)",
          }}
        >
          {SECTIONS.map((s) => {
            const isActive = b.activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => b.setActiveSection(s.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] tracking-wide uppercase transition-all duration-200"
                style={{
                  color: isActive
                    ? "var(--fintheon-accent)"
                    : "var(--fintheon-muted)",
                  background: isActive
                    ? "color-mix(in srgb, var(--fintheon-accent) 12%, transparent)"
                    : "transparent",
                }}
              >
                <s.icon className="w-3 h-3" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div className="p-3 min-h-[200px] max-h-[420px] overflow-y-auto custom-scrollbar">
          {/* ═══ Section 1: Catalyst Watch ═══ */}
          {b.activeSection === "idea" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: "var(--fintheon-muted)" }}
              >
                Add a catalyst phrase to watch. Bias words are auto-removed.
                Alerts fire when scored items match.
              </p>

              {/* Inline phrase input */}
              <div
                className="rounded-lg p-3 space-y-2"
                style={{
                  background:
                    "color-mix(in srgb, var(--fintheon-bg) 60%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
                }}
              >
                <input
                  type="text"
                  value={b.newPhrase}
                  onChange={(e) => b.setNewPhrase(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") b.handleAddPhrase();
                  }}
                  placeholder="e.g. FOMC rate decision, tariff, NVDA earnings..."
                  maxLength={120}
                  className="w-full bg-transparent border rounded-md px-2.5 py-2 text-[12px] outline-none placeholder:text-gray-600 focus:border-[var(--fintheon-accent)]/40 transition-colors"
                  style={{
                    borderColor:
                      "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
                    color: "var(--fintheon-text)",
                    fontFamily: "var(--font-body)",
                  }}
                />

                <div className="flex gap-2">
                  {/* Match type toggle */}
                  <div
                    className="flex flex-1 rounded-md overflow-hidden"
                    style={{
                      border:
                        "1px solid color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
                    }}
                  >
                    {(["contains", "exact"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => b.setPhraseMatchType(t)}
                        className="flex-1 py-1 text-[9px] uppercase tracking-wide transition-colors"
                        style={{
                          color:
                            b.phraseMatchType === t
                              ? "var(--fintheon-accent)"
                              : "var(--fintheon-muted)",
                          background:
                            b.phraseMatchType === t
                              ? "color-mix(in srgb, var(--fintheon-accent) 12%, transparent)"
                              : "transparent",
                        }}
                      >
                        {t === "contains" ? "Contains" : "Exact"}
                      </button>
                    ))}
                  </div>

                  {/* Repeating toggle */}
                  <div
                    className="flex flex-1 rounded-md overflow-hidden"
                    style={{
                      border:
                        "1px solid color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
                    }}
                  >
                    {([false, true] as const).map((r) => (
                      <button
                        key={String(r)}
                        onClick={() => b.setPhraseRepeating(r)}
                        className="flex-1 py-1 text-[9px] uppercase tracking-wide transition-colors"
                        style={{
                          color:
                            b.phraseRepeating === r
                              ? "var(--fintheon-accent)"
                              : "var(--fintheon-muted)",
                          background:
                            b.phraseRepeating === r
                              ? "color-mix(in srgb, var(--fintheon-accent) 12%, transparent)"
                              : "transparent",
                        }}
                      >
                        {r ? "Repeat" : "Once"}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={b.handleAddPhrase}
                  disabled={b.phraseSubmitting || !b.newPhrase.trim()}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-medium tracking-wide uppercase transition-all duration-200 disabled:opacity-40"
                  style={{
                    color: "var(--fintheon-accent)",
                    background:
                      "color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
                  }}
                >
                  <Plus className="w-3 h-3" />
                  {b.phraseSubmitting ? "Adding..." : "Add Catalyst Watch"}
                </button>
              </div>

              {/* Bias warning */}
              {b.biasWarning && (
                <p
                  className="text-[10px] italic animate-in fade-in duration-200"
                  style={{ color: "var(--fintheon-bearish, #EF4444)" }}
                >
                  {b.biasWarning}
                </p>
              )}

              {/* Active phrases list */}
              {b.phrases.length > 0 ? (
                <div className="space-y-1">
                  <span
                    className="text-[9px] uppercase tracking-widest"
                    style={{ color: "var(--fintheon-muted)" }}
                  >
                    Active watches
                  </span>
                  {b.phrases.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-md group"
                      style={{
                        background:
                          "color-mix(in srgb, var(--fintheon-bg) 40%, transparent)",
                      }}
                    >
                      <Crosshair
                        className="w-3 h-3 shrink-0"
                        style={{
                          color: "var(--fintheon-accent)",
                          opacity: 0.5,
                        }}
                      />
                      <span
                        className="text-[11px] flex-1 truncate"
                        style={{
                          color: "var(--fintheon-text)",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        {p.phrase}
                      </span>
                      {p.matchCount > 0 && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full font-mono"
                          style={{
                            color: "var(--fintheon-accent)",
                            background:
                              "color-mix(in srgb, var(--fintheon-accent) 12%, transparent)",
                          }}
                        >
                          {p.matchCount}
                        </span>
                      )}
                      <span
                        className="text-[8px]"
                        style={{ color: "var(--fintheon-muted)" }}
                      >
                        {p.repeating ? "repeat" : "once"}
                      </span>
                      <button
                        onClick={() => b.handleDeletePhrase(p.id)}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/5 transition-all"
                        style={{ color: "var(--fintheon-muted)" }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="text-center py-4 rounded-lg"
                  style={{
                    border:
                      "1px dashed color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
                  }}
                >
                  <Crosshair
                    className="w-5 h-5 mx-auto mb-2 opacity-30"
                    style={{ color: "var(--fintheon-accent)" }}
                  />
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--fintheon-muted)" }}
                  >
                    No active watches. Add a catalyst phrase above.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ═══ Section 2: Antilag Times ═══ */}
          {b.activeSection === "antilag" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: "var(--fintheon-muted)" }}
                >
                  Log antilag observations. Aggregated across all users for
                  Autopilot.
                </p>
                <button
                  onClick={() => b.setShowQuickClock(!b.showQuickClock)}
                  className="text-[8px] px-1.5 py-0.5 rounded transition-colors"
                  style={{
                    color: b.showQuickClock
                      ? "var(--fintheon-accent)"
                      : "var(--fintheon-muted)",
                    background: b.showQuickClock
                      ? "color-mix(in srgb, var(--fintheon-accent) 10%, transparent)"
                      : "transparent",
                  }}
                >
                  {b.showQuickClock ? "Hide" : "Show"} Quick
                </button>
              </div>

              {/* Quick Clock — one-tap */}
              {b.showQuickClock && (
                <button
                  onClick={b.handleQuickClock}
                  className="w-full flex items-center justify-center gap-2.5 py-3 rounded-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]"
                  style={{
                    background: b.quickClockPulse
                      ? "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)"
                      : "color-mix(in srgb, var(--fintheon-accent) 8%, transparent)",
                    border: `1px solid color-mix(in srgb, var(--fintheon-accent) ${b.quickClockPulse ? "40" : "20"}%, transparent)`,
                    boxShadow: b.quickClockPulse
                      ? "0 0 12px color-mix(in srgb, var(--fintheon-accent) 15%, transparent)"
                      : "none",
                    transition: "all 0.3s ease",
                  }}
                >
                  <Clock
                    className="w-5 h-5"
                    style={{
                      color: "var(--fintheon-accent)",
                      transform: b.quickClockPulse ? "scale(1.2)" : "scale(1)",
                      transition: "transform 0.3s ease",
                    }}
                  />
                  <div className="text-left">
                    <span
                      className="text-[12px] font-medium block"
                      style={{ color: "var(--fintheon-accent)" }}
                    >
                      Clock Antilag Now
                    </span>
                    <span
                      className="text-[9px]"
                      style={{ color: "var(--fintheon-muted)" }}
                    >
                      {b.selectedSymbol.symbol || "ES"} ·{" "}
                      {DAY_LABELS[new Date().getDay()]} · auto-time
                    </span>
                  </div>
                  <Zap
                    className="w-3.5 h-3.5"
                    style={{ color: "var(--fintheon-accent)", opacity: 0.4 }}
                  />
                </button>
              )}

              {/* Hot Times — collapsible */}
              <div>
                <button
                  onClick={() => b.setShowHotTimes(!b.showHotTimes)}
                  className="w-full flex items-center justify-between py-1.5 px-2 rounded-md transition-colors hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3 h-3" style={{ color: "#F97316" }} />
                    <span
                      className="text-[10px] font-medium uppercase tracking-wide"
                      style={{ color: "var(--fintheon-accent)" }}
                    >
                      Hot Times
                    </span>
                  </div>
                  {b.showHotTimes ? (
                    <ChevronUp
                      className="w-3 h-3"
                      style={{ color: "var(--fintheon-muted)" }}
                    />
                  ) : (
                    <ChevronDown
                      className="w-3 h-3"
                      style={{ color: "var(--fintheon-muted)" }}
                    />
                  )}
                </button>

                {b.showHotTimes && (
                  <div
                    className="mt-1 rounded-lg p-2.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150"
                    style={{
                      background:
                        "color-mix(in srgb, var(--fintheon-bg) 50%, transparent)",
                      border:
                        "1px solid color-mix(in srgb, #F97316 12%, transparent)",
                    }}
                  >
                    {/* Day toggle */}
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[9px] uppercase tracking-widest"
                        style={{ color: "var(--fintheon-muted)" }}
                      >
                        Top 3 fifteen-minute windows
                      </span>
                      <button
                        onClick={() => b.setHotTimesByDay(!b.hotTimesByDay)}
                        className="text-[8px] px-1.5 py-0.5 rounded transition-colors"
                        style={{
                          color: b.hotTimesByDay
                            ? "#F97316"
                            : "var(--fintheon-muted)",
                          background: b.hotTimesByDay
                            ? "color-mix(in srgb, #F97316 10%, transparent)"
                            : "transparent",
                        }}
                      >
                        {b.hotTimesByDay ? "By Day" : "All Days"}
                      </button>
                    </div>

                    {!b.hotTimesLoaded ? (
                      <p
                        className="text-[10px] text-center py-2"
                        style={{ color: "var(--fintheon-muted)" }}
                      >
                        Loading...
                      </p>
                    ) : b.hotTimes.length === 0 ? (
                      <p
                        className="text-[10px] text-center py-2"
                        style={{ color: "var(--fintheon-muted)" }}
                      >
                        No data yet. Log antilag times to see patterns.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {b.hotTimes.map((ht, i) => {
                          const maxCount = b.hotTimes[0]?.count || 1;
                          const barWidth = Math.max(
                            15,
                            (ht.count / maxCount) * 100,
                          );
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-2 py-1"
                            >
                              <span
                                className="text-[11px] font-mono w-[100px] shrink-0"
                                style={{ color: "var(--fintheon-text)" }}
                              >
                                {ht.bucket}
                              </span>
                              {ht.dayOfWeek !== undefined && (
                                <span
                                  className="text-[9px] w-[28px] shrink-0"
                                  style={{ color: "var(--fintheon-muted)" }}
                                >
                                  {DAY_LABELS[ht.dayOfWeek]}
                                </span>
                              )}
                              <div
                                className="flex-1 h-[6px] rounded-full overflow-hidden"
                                style={{
                                  background:
                                    "color-mix(in srgb, var(--fintheon-bg) 70%, transparent)",
                                }}
                              >
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${barWidth}%`,
                                    background:
                                      i === 0
                                        ? "#F97316"
                                        : i === 1
                                          ? "#FB923C"
                                          : "#FDBA74",
                                  }}
                                />
                              </div>
                              <span
                                className="text-[9px] font-mono w-[20px] text-right"
                                style={{ color: "#F97316" }}
                              >
                                {ht.count}
                              </span>
                              <span
                                className="text-[8px] truncate max-w-[50px]"
                                style={{ color: "var(--fintheon-muted)" }}
                              >
                                {ht.instruments.join(", ")}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Manual entry form */}
              <div
                className="rounded-lg p-3 space-y-2"
                style={{
                  background:
                    "color-mix(in srgb, var(--fintheon-bg) 60%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
                }}
              >
                <span
                  className="text-[9px] uppercase tracking-widest"
                  style={{ color: "var(--fintheon-muted)" }}
                >
                  Manual entry
                </span>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={b.newAntilagTime}
                    onChange={(e) => b.setNewAntilagTime(e.target.value)}
                    className="flex-1 bg-transparent border rounded-md px-2 py-1.5 text-[11px] outline-none focus:border-[var(--fintheon-accent)]/40 transition-colors"
                    style={{
                      borderColor:
                        "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
                      color: "var(--fintheon-text)",
                    }}
                  />
                  <select
                    value={b.newAntilagDay}
                    onChange={(e) =>
                      b.setNewAntilagDay(parseInt(e.target.value, 10))
                    }
                    className="bg-transparent border rounded-md px-2 py-1.5 text-[11px] outline-none focus:border-[var(--fintheon-accent)]/40 transition-colors"
                    style={{
                      borderColor:
                        "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
                      color: "var(--fintheon-text)",
                    }}
                  >
                    {DAY_LABELS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <select
                    value={b.newAntilagInstrument}
                    onChange={(e) => b.setNewAntilagInstrument(e.target.value)}
                    className="bg-transparent border rounded-md px-2 py-1.5 text-[11px] outline-none focus:border-[var(--fintheon-accent)]/40 transition-colors"
                    style={{
                      borderColor:
                        "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
                      color: "var(--fintheon-text)",
                    }}
                  >
                    {["ES", "NQ", "YM", "RTY", "CL", "GC", "SI", "BTC"].map(
                      (sym) => (
                        <option key={sym} value={sym}>
                          {sym}
                        </option>
                      ),
                    )}
                  </select>
                  <input
                    type="text"
                    value={b.newAntilagNotes}
                    onChange={(e) => b.setNewAntilagNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="flex-1 bg-transparent border rounded-md px-2 py-1.5 text-[11px] outline-none placeholder:text-gray-600 focus:border-[var(--fintheon-accent)]/40 transition-colors"
                    style={{
                      borderColor:
                        "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
                      color: "var(--fintheon-text)",
                    }}
                  />
                </div>
                <button
                  onClick={b.handleAddAntilag}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-medium tracking-wide uppercase transition-all duration-200"
                  style={{
                    color: "var(--fintheon-accent)",
                    background:
                      "color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
                  }}
                >
                  <Plus className="w-3 h-3" />
                  Log Antilag
                </button>
              </div>

              {/* Recent entries */}
              {b.antilagTimes.length > 0 && (
                <div className="space-y-1">
                  <span
                    className="text-[9px] uppercase tracking-widest"
                    style={{ color: "var(--fintheon-muted)" }}
                  >
                    Recent observations
                  </span>
                  {b.antilagTimes.slice(0, 6).map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-md"
                      style={{
                        background:
                          "color-mix(in srgb, var(--fintheon-bg) 40%, transparent)",
                      }}
                    >
                      <Clock
                        className="w-3 h-3 shrink-0"
                        style={{
                          color: "var(--fintheon-accent)",
                          opacity: 0.6,
                        }}
                      />
                      <span
                        className="text-[11px] font-mono"
                        style={{ color: "var(--fintheon-text)" }}
                      >
                        {entry.time}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--fintheon-muted)" }}
                      >
                        {DAY_LABELS[entry.dayOfWeek]}
                      </span>
                      <span
                        className="text-[10px] font-medium"
                        style={{
                          color: "var(--fintheon-accent)",
                          opacity: 0.7,
                        }}
                      >
                        {entry.instrument}
                      </span>
                      {entry.notes && (
                        <span
                          className="text-[9px] truncate flex-1"
                          style={{ color: "var(--fintheon-muted)" }}
                        >
                          {entry.notes}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ Section 3: Event of the Week ═══ */}
          {b.activeSection === "event" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <p
                  className="text-[11px]"
                  style={{ color: "var(--fintheon-muted)" }}
                >
                  Your weekly forecast or key event to monitor.
                </p>
                {!b.editingEvent && b.eventOfWeek && (
                  <button
                    onClick={() => b.setEditingEvent(true)}
                    className="text-[9px] px-2 py-0.5 rounded transition-colors"
                    style={{
                      color: "var(--fintheon-accent)",
                      background:
                        "color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>

              {b.editingEvent || !b.eventOfWeek ? (
                <div className="space-y-2">
                  <textarea
                    value={b.eventOfWeek}
                    onChange={(e) => b.handleEventChange(e.target.value)}
                    onFocus={() => b.setEditingEvent(true)}
                    onBlur={() =>
                      setTimeout(() => b.setEditingEvent(false), 300)
                    }
                    placeholder="e.g. FOMC rate decision Wednesday 2pm — expecting hawkish hold, watching for dot plot shifts..."
                    rows={4}
                    className="w-full bg-transparent border rounded-lg px-3 py-2 text-[12px] leading-relaxed outline-none resize-none placeholder:text-gray-600 focus:border-[var(--fintheon-accent)]/30 transition-colors"
                    style={{
                      borderColor:
                        "color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
                      color: "var(--fintheon-text)",
                      fontFamily: "var(--font-body)",
                    }}
                  />
                  <div className="flex justify-end">
                    <span
                      className="text-[9px] italic"
                      style={{ color: "var(--fintheon-muted)", opacity: 0.6 }}
                    >
                      Auto-saves
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-lg p-3 cursor-pointer transition-all duration-200 hover:bg-white/[0.02]"
                  onClick={() => b.setEditingEvent(true)}
                  style={{
                    background:
                      "color-mix(in srgb, var(--fintheon-bg) 50%, transparent)",
                    border:
                      "1px solid color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
                  }}
                >
                  <p
                    className="text-[12px] leading-relaxed whitespace-pre-wrap"
                    style={{
                      color: "var(--fintheon-text)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {b.eventOfWeek}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ═══ Section 4: Trading Notes ═══ */}
          {b.activeSection === "notes" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <p
                  className="text-[11px]"
                  style={{ color: "var(--fintheon-muted)" }}
                >
                  Personal trading notes. Always saved.
                </p>
                {!b.editingNotes && b.tradingNotes && (
                  <button
                    onClick={() => b.setEditingNotes(true)}
                    className="text-[9px] px-2 py-0.5 rounded transition-colors"
                    style={{
                      color: "var(--fintheon-accent)",
                      background:
                        "color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>

              {b.editingNotes || !b.tradingNotes ? (
                <div className="space-y-2">
                  <textarea
                    value={b.tradingNotes}
                    onChange={(e) => b.handleNotesChange(e.target.value)}
                    onFocus={() => b.setEditingNotes(true)}
                    onBlur={() =>
                      setTimeout(() => b.setEditingNotes(false), 300)
                    }
                    placeholder="Jot down observations, patterns, reminders..."
                    rows={6}
                    className="w-full bg-transparent border rounded-lg px-3 py-2 text-[12px] leading-relaxed outline-none resize-none placeholder:text-gray-600 focus:border-[var(--fintheon-accent)]/30 transition-colors"
                    style={{
                      borderColor:
                        "color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
                      color: "var(--fintheon-text)",
                      fontFamily: "var(--font-body)",
                    }}
                  />
                  <div className="flex justify-end">
                    <span
                      className="text-[9px] italic"
                      style={{ color: "var(--fintheon-muted)", opacity: 0.6 }}
                    >
                      Auto-saves
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-lg p-3 cursor-pointer transition-all duration-200 hover:bg-white/[0.02]"
                  onClick={() => b.setEditingNotes(true)}
                  style={{
                    background:
                      "color-mix(in srgb, var(--fintheon-bg) 50%, transparent)",
                    border:
                      "1px solid color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
                  }}
                >
                  <p
                    className="text-[12px] leading-relaxed whitespace-pre-wrap"
                    style={{
                      color: "var(--fintheon-text)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {b.tradingNotes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — subtle accent line */}
        <div
          className="h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, color-mix(in srgb, var(--fintheon-accent) 25%, transparent), transparent)",
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
