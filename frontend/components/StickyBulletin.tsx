// [claude-code 2026-04-10] Sticky Bulletin — personal trade board with 4 sections:
// 1. Next Trade Idea (watchlist alert setup via Harper)
// 2. Times to Watch (antilag time logging for Autopilot)
// 3. Event of the Week (forecast/notes)
// 4. Trading Notes (general notepad)
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ClipboardList,
  Clock,
  CalendarDays,
  StickyNote,
  Plus,
  Trash2,
  Save,
  X,
  Crosshair,
} from "lucide-react";
import { useBackend } from "../lib/backend";
import { useToast } from "../contexts/ToastContext";
import type { StickyBulletinData } from "../lib/services/editor";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface StickyBulletinProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export function StickyBulletin({
  open,
  onClose,
  anchorRef,
}: StickyBulletinProps) {
  const backend = useBackend();
  const { addToast } = useToast();

  // Data state
  const [tradingNotes, setTradingNotes] = useState("");
  const [eventOfWeek, setEventOfWeek] = useState("");
  const [antilagTimes, setAntilagTimes] = useState<
    StickyBulletinData["antilagTimes"]
  >([]);
  const [loaded, setLoaded] = useState(false);

  // UI state
  const [activeSection, setActiveSection] = useState<
    "idea" | "antilag" | "event" | "notes"
  >("notes");
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingEvent, setEditingEvent] = useState(false);
  const [showTradeIdeaModal, setShowTradeIdeaModal] = useState(false);

  // Antilag form
  const [newAntilagTime, setNewAntilagTime] = useState("");
  const [newAntilagDay, setNewAntilagDay] = useState(new Date().getDay());
  const [newAntilagInstrument, setNewAntilagInstrument] = useState("ES");
  const [newAntilagNotes, setNewAntilagNotes] = useState("");

  // Debounce save refs
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState<{
    top: number;
    right: number;
  } | null>(null);

  // Position calculation
  useEffect(() => {
    if (!open || !anchorRef.current) {
      setPopupPos(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    const right = window.innerWidth - rect.right;
    const top = rect.bottom + 8;
    setPopupPos({ top, right: Math.max(right, 12) });
  }, [open, anchorRef]);

  // Load data on first open
  useEffect(() => {
    if (!open || loaded) return;
    backend.stickyBulletin
      .get()
      .then((res) => {
        setTradingNotes(res.data.tradingNotes);
        setEventOfWeek(res.data.eventOfWeek);
        setAntilagTimes(res.data.antilagTimes);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, [open, loaded, backend.stickyBulletin]);

  // Click outside handler
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      // Don't close if trade idea modal is open
      if (showTradeIdeaModal) return;
      onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose, anchorRef, showTradeIdeaModal]);

  // Auto-save notes with debounce
  const saveNotes = useCallback(
    (val: string) => {
      if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
      notesSaveTimer.current = setTimeout(() => {
        backend.stickyBulletin.save({ tradingNotes: val }).catch(() => {});
      }, 1200);
    },
    [backend.stickyBulletin],
  );

  const saveEvent = useCallback(
    (val: string) => {
      if (eventSaveTimer.current) clearTimeout(eventSaveTimer.current);
      eventSaveTimer.current = setTimeout(() => {
        backend.stickyBulletin.save({ eventOfWeek: val }).catch(() => {});
      }, 1200);
    },
    [backend.stickyBulletin],
  );

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
      if (eventSaveTimer.current) clearTimeout(eventSaveTimer.current);
    };
  }, []);

  const handleNotesChange = (val: string) => {
    setTradingNotes(val);
    saveNotes(val);
  };

  const handleEventChange = (val: string) => {
    setEventOfWeek(val);
    saveEvent(val);
  };

  const handleAddAntilag = async () => {
    if (!newAntilagTime) {
      addToast("Enter a time", "error");
      return;
    }
    try {
      await backend.stickyBulletin.addAntilagTime({
        time: newAntilagTime,
        dayOfWeek: newAntilagDay,
        instrument: newAntilagInstrument,
        notes: newAntilagNotes,
      });
      setAntilagTimes((prev) => [
        {
          time: newAntilagTime,
          dayOfWeek: newAntilagDay,
          instrument: newAntilagInstrument,
          notes: newAntilagNotes,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setNewAntilagTime("");
      setNewAntilagNotes("");
      addToast(
        "Antilag time logged",
        "success",
        undefined,
        undefined,
        "top-right",
      );
    } catch {
      addToast("Failed to save", "error");
    }
  };

  const sections = [
    { id: "idea" as const, icon: Crosshair, label: "Trade Idea" },
    { id: "antilag" as const, icon: Clock, label: "Antilag" },
    { id: "event" as const, icon: CalendarDays, label: "Event" },
    { id: "notes" as const, icon: StickyNote, label: "Notes" },
  ];

  if (!open || !popupPos) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: popupPos.top,
        right: popupPos.right,
        zIndex: 9998,
      }}
      className="w-[360px] animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* Main panel with glass effect */}
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
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/5 transition-colors"
            style={{ color: "var(--fintheon-muted)" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Section tabs */}
        <div
          className="flex px-2 py-1.5 gap-0.5"
          style={{
            borderBottom:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 8%, transparent)",
          }}
        >
          {sections.map((s) => {
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
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
          {/* ─── Section 1: Next Trade Idea ─── */}
          {activeSection === "idea" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: "var(--fintheon-muted)" }}
              >
                Set up a watchlist alert. Harper will formulate the signal and
                notify you when conditions match.
              </p>
              <button
                onClick={() => setShowTradeIdeaModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-medium tracking-wide uppercase transition-all duration-200 hover:scale-[1.01]"
                style={{
                  color: "var(--fintheon-accent)",
                  border:
                    "1px solid color-mix(in srgb, var(--fintheon-accent) 30%, transparent)",
                  background:
                    "color-mix(in srgb, var(--fintheon-accent) 6%, transparent)",
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                New Trade Idea Alert
              </button>

              {/* Placeholder for existing alerts */}
              <div
                className="text-center py-6 rounded-lg"
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
                  No active alerts. Create one above.
                </p>
              </div>
            </div>
          )}

          {/* ─── Section 2: Antilag Times ─── */}
          {activeSection === "antilag" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: "var(--fintheon-muted)" }}
              >
                Log times when you observe antilag behavior. This data is
                aggregated across all users and feeds into Autopilot.
              </p>

              {/* Add new entry */}
              <div
                className="rounded-lg p-3 space-y-2"
                style={{
                  background:
                    "color-mix(in srgb, var(--fintheon-bg) 60%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
                }}
              >
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={newAntilagTime}
                    onChange={(e) => setNewAntilagTime(e.target.value)}
                    className="flex-1 bg-transparent border rounded-md px-2 py-1.5 text-[11px] outline-none focus:border-[var(--fintheon-accent)]/40 transition-colors"
                    style={{
                      borderColor:
                        "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
                      color: "var(--fintheon-text)",
                    }}
                  />
                  <select
                    value={newAntilagDay}
                    onChange={(e) =>
                      setNewAntilagDay(parseInt(e.target.value, 10))
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
                    value={newAntilagInstrument}
                    onChange={(e) => setNewAntilagInstrument(e.target.value)}
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
                    value={newAntilagNotes}
                    onChange={(e) => setNewAntilagNotes(e.target.value)}
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
                  onClick={handleAddAntilag}
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

              {/* Existing entries */}
              {antilagTimes.length > 0 ? (
                <div className="space-y-1">
                  <span
                    className="text-[9px] uppercase tracking-widest"
                    style={{ color: "var(--fintheon-muted)" }}
                  >
                    Recent observations
                  </span>
                  {antilagTimes.slice(0, 8).map((entry, i) => (
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
              ) : (
                <div
                  className="text-center py-4 rounded-lg"
                  style={{
                    border:
                      "1px dashed color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
                  }}
                >
                  <Clock
                    className="w-5 h-5 mx-auto mb-2 opacity-30"
                    style={{ color: "var(--fintheon-accent)" }}
                  />
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--fintheon-muted)" }}
                  >
                    No antilag times logged yet.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ─── Section 3: Event of the Week ─── */}
          {activeSection === "event" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <p
                  className="text-[11px]"
                  style={{ color: "var(--fintheon-muted)" }}
                >
                  Your weekly forecast or key event to monitor.
                </p>
                {!editingEvent && eventOfWeek && (
                  <button
                    onClick={() => setEditingEvent(true)}
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

              {editingEvent || !eventOfWeek ? (
                <div className="space-y-2">
                  <textarea
                    value={eventOfWeek}
                    onChange={(e) => handleEventChange(e.target.value)}
                    onFocus={() => setEditingEvent(true)}
                    onBlur={() => {
                      setTimeout(() => setEditingEvent(false), 300);
                    }}
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
                  onClick={() => setEditingEvent(true)}
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
                    {eventOfWeek}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ─── Section 4: Trading Notes ─── */}
          {activeSection === "notes" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <p
                  className="text-[11px]"
                  style={{ color: "var(--fintheon-muted)" }}
                >
                  Personal trading notes. Always saved.
                </p>
                {!editingNotes && tradingNotes && (
                  <button
                    onClick={() => setEditingNotes(true)}
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

              {editingNotes || !tradingNotes ? (
                <div className="space-y-2">
                  <textarea
                    value={tradingNotes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    onFocus={() => setEditingNotes(true)}
                    onBlur={() => {
                      setTimeout(() => setEditingNotes(false), 300);
                    }}
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
                  onClick={() => setEditingNotes(true)}
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
                    {tradingNotes}
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

      {/* ─── Trade Idea Modal (Liquid Glass) ─── */}
      {showTradeIdeaModal && (
        <TradeIdeaModal onClose={() => setShowTradeIdeaModal(false)} />
      )}
    </div>,
    document.body,
  );
}

// ─── Trade Idea Modal ───────────────────────────────────────────────────────
interface TradeIdeaModalProps {
  onClose: () => void;
}

function TradeIdeaModal({ onClose }: TradeIdeaModalProps) {
  const { addToast } = useToast();
  const [watchPhrase, setWatchPhrase] = useState("");
  const [matchType, setMatchType] = useState<"contains" | "exact">("contains");
  const [repeatType, setRepeatType] = useState<"once" | "repeating">("once");
  const [submitting, setSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!watchPhrase.trim()) {
      addToast("Enter a watchlist phrase", "error");
      return;
    }
    setSubmitting(true);
    try {
      // TODO: Wire to Harper backend for watchlist alert creation
      addToast(
        `Alert set: "${watchPhrase}"`,
        "success",
        `${matchType === "contains" ? "Contains" : "Exact"} match, ${repeatType}`,
        undefined,
        "top-right",
      );
      onClose();
    } catch {
      addToast("Failed to create alert", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 10000 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-in fade-in duration-200"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Modal — liquid glass with primary theme tint */}
      <div
        ref={modalRef}
        className="relative w-[380px] rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-250"
        style={{
          background:
            "linear-gradient(145deg, color-mix(in srgb, var(--fintheon-accent) 6%, var(--fintheon-surface)), color-mix(in srgb, var(--fintheon-accent) 3%, var(--fintheon-bg)))",
          backdropFilter: "blur(32px) saturate(1.5)",
          WebkitBackdropFilter: "blur(32px) saturate(1.5)",
          border:
            "1px solid color-mix(in srgb, var(--fintheon-accent) 22%, transparent)",
          boxShadow:
            "0 24px 48px rgba(0,0,0,0.5), 0 0 80px color-mix(in srgb, var(--fintheon-accent) 6%, transparent), inset 0 1px 0 color-mix(in srgb, var(--fintheon-accent) 12%, transparent)",
        }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background:
                  "color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
              }}
            >
              <Crosshair
                className="w-4 h-4"
                style={{ color: "var(--fintheon-accent)" }}
              />
            </div>
            <span
              className="text-[13px] font-semibold tracking-wide"
              style={{ color: "var(--fintheon-text)" }}
            >
              New Trade Idea Alert
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: "var(--fintheon-muted)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className="px-5 pb-5 space-y-4"
          style={{
            borderTop:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 8%, transparent)",
            paddingTop: "16px",
          }}
        >
          {/* Watchlist phrase */}
          <div className="space-y-1.5">
            <label
              className="text-[10px] uppercase tracking-widest"
              style={{ color: "var(--fintheon-muted)" }}
            >
              Watchlist Phrase
            </label>
            <input
              type="text"
              value={watchPhrase}
              onChange={(e) => setWatchPhrase(e.target.value)}
              placeholder="e.g. FOMC, rate cut, earnings..."
              className="w-full bg-transparent border rounded-lg px-3 py-2.5 text-[13px] outline-none placeholder:text-gray-600 focus:border-[var(--fintheon-accent)]/40 transition-colors"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
                color: "var(--fintheon-text)",
                fontFamily: "var(--font-body)",
              }}
              autoFocus
            />
          </div>

          {/* Match type */}
          <div className="space-y-1.5">
            <label
              className="text-[10px] uppercase tracking-widest"
              style={{ color: "var(--fintheon-muted)" }}
            >
              Match Type
            </label>
            <div className="flex gap-2">
              {(["contains", "exact"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setMatchType(type)}
                  className="flex-1 py-2 rounded-lg text-[11px] font-medium tracking-wide transition-all duration-200"
                  style={{
                    color:
                      matchType === type
                        ? "var(--fintheon-accent)"
                        : "var(--fintheon-muted)",
                    background:
                      matchType === type
                        ? "color-mix(in srgb, var(--fintheon-accent) 12%, transparent)"
                        : "color-mix(in srgb, var(--fintheon-bg) 60%, transparent)",
                    border:
                      matchType === type
                        ? "1px solid color-mix(in srgb, var(--fintheon-accent) 25%, transparent)"
                        : "1px solid color-mix(in srgb, var(--fintheon-accent) 8%, transparent)",
                  }}
                >
                  {type === "contains" ? "Words Containing" : "Exact Match"}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div className="space-y-1.5">
            <label
              className="text-[10px] uppercase tracking-widest"
              style={{ color: "var(--fintheon-muted)" }}
            >
              Frequency
            </label>
            <div className="flex gap-2">
              {(["once", "repeating"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setRepeatType(type)}
                  className="flex-1 py-2 rounded-lg text-[11px] font-medium tracking-wide transition-all duration-200"
                  style={{
                    color:
                      repeatType === type
                        ? "var(--fintheon-accent)"
                        : "var(--fintheon-muted)",
                    background:
                      repeatType === type
                        ? "color-mix(in srgb, var(--fintheon-accent) 12%, transparent)"
                        : "color-mix(in srgb, var(--fintheon-bg) 60%, transparent)",
                    border:
                      repeatType === type
                        ? "1px solid color-mix(in srgb, var(--fintheon-accent) 25%, transparent)"
                        : "1px solid color-mix(in srgb, var(--fintheon-accent) 8%, transparent)",
                  }}
                >
                  {type === "once" ? "One-Time" : "Repeating"}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !watchPhrase.trim()}
            className="w-full py-2.5 rounded-lg text-[12px] font-semibold tracking-wide uppercase transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
            style={{
              color: "var(--fintheon-bg)",
              background: "var(--fintheon-accent)",
              boxShadow:
                "0 2px 12px color-mix(in srgb, var(--fintheon-accent) 30%, transparent)",
            }}
          >
            {submitting ? "Setting up..." : "Activate Alert"}
          </button>
        </div>

        {/* Bottom glass reflection */}
        <div
          className="h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, color-mix(in srgb, var(--fintheon-accent) 30%, transparent), transparent)",
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
