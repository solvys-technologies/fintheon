// [claude-code 2026-04-10] Sticky Bulletin — personal trade board with 4 sections
// [claude-code 2026-04-11] v2: Inline Catalyst Watch, Hot Times dropdown, Quick Clock
// [claude-code 2026-04-11] v3: Extracted hook to useStickyBulletin.ts
// [claude-code 2026-04-17] v4: Drag migrated to useDraggable hook (pointer events + rAF, grip-only)
// [Codex 2026-05-27] Use exported lucide Clock instead of unavailable Clock705.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Bell,
  ClipboardList,
  Clock,
  Eye,
  StickyNote,
  Plus,
  X,
  Flame,
  ChevronDown,
  ChevronUp,
  GripVertical,
  TrendingUp,
} from "lucide-react";
import {
  useStickyBulletin,
  DAY_LABELS,
  type SectionId,
} from "../hooks/useStickyBulletin";
import { useDayPlanMultiWeek } from "../hooks/useDayPlanWeek";
import { BulletinInboxTab } from "./bulletin/BulletinInboxTab";
import { BulletinDeskPlanTab } from "./bulletin/BulletinDeskPlanTab";
import { WatchTagsTab } from "./bulletin/WatchTagsTab";
import { QueuedDeskEventFeed } from "./desk/QueuedDeskEventFeed";

interface StickyBulletinProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  variant?: "desktop-popover" | "mobile-dropdown";
  initialSection?: SectionId;
}

const SECTIONS = [
  { id: "inbox" as const, icon: Bell, label: "Inbox" },
  { id: "desk" as const, icon: BookOpen, label: "Desk" },
  { id: "antilag" as const, icon: Clock, label: "Antilag" },
  { id: "watch" as const, icon: Eye, label: "Watch" },
  { id: "notes" as const, icon: StickyNote, label: "Notes" },
  { id: "upcoming" as const, icon: TrendingUp, label: "Upcoming" },
];

export function StickyBulletin({
  open,
  onClose,
  anchorRef,
  variant = "desktop-popover",
  initialSection,
}: StickyBulletinProps) {
  const b = useStickyBulletin(open, anchorRef);
  const isMobileDropdown = variant === "mobile-dropdown";
  const [manualPos, setManualPos] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    top: number;
    right: number;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setManualPos(null);
      setDrag(null);
    }
  }, [open]);

  useEffect(() => {
    if (open && initialSection) b.setActiveSection(initialSection);
  }, [open, initialSection]);

  const panelPosition = (isMobileDropdown ? null : manualPos) ?? b.popupPos;
  if (!open || !panelPosition) return null;

  const posStyle = isMobileDropdown
    ? {
        position: "fixed" as const,
        top: Math.max(58, panelPosition.top),
        left: 12,
        right: 12,
        zIndex: 9998,
      }
    : {
        position: "fixed" as const,
        top: panelPosition.top,
        right: panelPosition.right,
        zIndex: 9998,
      };

  return createPortal(
    <div
      ref={b.panelRef}
      data-bulletin-panel
      style={posStyle}
      className={`${isMobileDropdown ? "w-auto" : "w-[360px]"} animate-in fade-in slide-in-from-top-2 duration-200`}
      onMouseMove={(event) => {
        if (isMobileDropdown || !drag) return;
        setManualPos({
          top: Math.max(12, drag.top + event.clientY - drag.y),
          right: Math.max(12, drag.right - (event.clientX - drag.x)),
        });
      }}
      onMouseUp={() => setDrag(null)}
      onMouseLeave={() => setDrag(null)}
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
          className={`flex items-center justify-between px-4 py-3 ${isMobileDropdown ? "cursor-default" : "cursor-move"}`}
          style={{
            borderBottom:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 12%, transparent)",
          }}
          onMouseDown={(event) => {
            if (isMobileDropdown) return;
            setDrag({
              x: event.clientX,
              y: event.clientY,
              top: panelPosition.top,
              right: panelPosition.right,
            });
          }}
        >
          <div className="flex items-center gap-2">
            {!isMobileDropdown && (
              <button
                className="cursor-grab active:cursor-grabbing touch-none p-0.5"
                title="Drag"
                aria-label="Drag bulletin"
              >
                <GripVertical
                  className="w-3.5 h-3.5"
                  style={{ color: "var(--fintheon-accent)", opacity: 0.4 }}
                />
              </button>
            )}
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
                onMouseDown={(event) => event.stopPropagation()}
                className="p-1 rounded-md hover:bg-[var(--fintheon-accent)]/10 transition-all active:scale-90"
                style={{
                  color: b.quickClockPulse
                    ? "var(--fintheon-accent)"
                    : "var(--fintheon-muted)",
                }}
                title="Quick clock antilag"
              >
                <Clock
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
              onMouseDown={(event) => event.stopPropagation()}
              className="p-1 rounded-md hover:bg-white/5 transition-colors"
              style={{ color: "var(--fintheon-muted)" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Section tabs */}
        <div
          className={
            isMobileDropdown ? "px-3 py-2" : "flex px-2 py-1.5 gap-0.5"
          }
          style={{
            borderBottom:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 8%, transparent)",
          }}
        >
          {isMobileDropdown ? (
            <select
              aria-label="Bulletin section"
              value={b.activeSection}
              onChange={(event) =>
                b.setActiveSection(event.target.value as typeof b.activeSection)
              }
              className="h-9 w-full rounded-lg border bg-[var(--fintheon-bg)] px-3 text-[11px] uppercase tracking-[0.14em] text-[var(--fintheon-accent)] outline-none"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--fintheon-accent) 18%, transparent)",
              }}
            >
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            SECTIONS.map((s) => {
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
                    background: "transparent",
                  }}
                >
                  <s.icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })
          )}
        </div>

        {/* Content area */}
        <div
          className={`p-3 min-h-[200px] overflow-y-auto custom-scrollbar ${
            isMobileDropdown ? "max-h-[calc(100dvh-164px)]" : "max-h-[420px]"
          }`}
        >
          {/* ═══ Section 1: Inbox ═══ */}
          {b.activeSection === "inbox" && <BulletinInboxTab />}

          {/* ═══ Section 1: Desk Plan ═══ */}
          {b.activeSection === "desk" && <BulletinDeskPlanTab />}

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
                  <Clock
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

          {/* ═══ Section 3: WatchTags ═══ */}
          {b.activeSection === "watch" && <WatchTagsTab />}

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

          {/* ═══ Section 5: Upcoming Desk Queue ═══ */}
          {b.activeSection === "upcoming" && <UpcomingBulletinTab />}
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

function UpcomingBulletinTab() {
  const { allPlans, isLoading, error } = useDayPlanMultiWeek();

  return (
    <QueuedDeskEventFeed
      plans={allPlans}
      isLoading={isLoading}
      error={error ? "Queued desk plans unavailable." : null}
      compact
      maxItems={8}
      className="max-h-[340px]"
    />
  );
}
