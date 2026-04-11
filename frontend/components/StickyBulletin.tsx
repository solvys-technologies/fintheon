// [claude-code 2026-04-10] Sticky Bulletin — personal trade board with 4 sections:
// 1. Catalyst Watch (watchlist phrase alerts wired to central-scorer)
// 2. Times to Watch (antilag time logging + Hot Times + Quick Clock)
// 3. Event of the Week (forecast/notes)
// 4. Trading Notes (general notepad)
// [claude-code 2026-04-11] v2: Inline Catalyst Watch, Hot Times dropdown, Quick Clock tap button
import { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import { useBackend } from "../lib/backend";
import { useToast } from "../contexts/ToastContext";
import { useSettings } from "../contexts/SettingsContext";
import type { StickyBulletinData } from "../lib/services/editor";
import type { WatchlistPhrase } from "../lib/services/riskflow";

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
  const { selectedSymbol } = useSettings();

  // Data state
  const [tradingNotes, setTradingNotes] = useState("");
  const [eventOfWeek, setEventOfWeek] = useState("");
  const [antilagTimes, setAntilagTimes] = useState<
    StickyBulletinData["antilagTimes"]
  >([]);
  const [loaded, setLoaded] = useState(false);

  // Catalyst Watch state
  const [phrases, setPhrases] = useState<WatchlistPhrase[]>([]);
  const [phrasesLoaded, setPhrasesLoaded] = useState(false);
  const [newPhrase, setNewPhrase] = useState("");
  const [phraseMatchType, setPhraseMatchType] = useState<"contains" | "exact">(
    "contains",
  );
  const [phraseRepeating, setPhraseRepeating] = useState(false);
  const [phraseSubmitting, setPhraseSubmitting] = useState(false);
  const [biasWarning, setBiasWarning] = useState("");

  // Hot Times state
  const [showHotTimes, setShowHotTimes] = useState(false);
  const [hotTimesLoaded, setHotTimesLoaded] = useState(false);
  const [hotTimesByDay, setHotTimesByDay] = useState(false);
  const [hotTimes, setHotTimes] = useState<
    Array<{
      bucket: string;
      dayOfWeek?: number;
      count: number;
      instruments: string[];
    }>
  >([]);

  // Quick Clock state
  const [showQuickClock, setShowQuickClock] = useState(true);
  const [quickClockPulse, setQuickClockPulse] = useState(false);

  // UI state
  const [activeSection, setActiveSection] = useState<
    "idea" | "antilag" | "event" | "notes"
  >("notes");
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingEvent, setEditingEvent] = useState(false);

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

  // Load bulletin data on first open
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
      .catch(() => setLoaded(true));
  }, [open, loaded, backend.stickyBulletin]);

  // Load phrases when Trade Idea section opens
  useEffect(() => {
    if (activeSection !== "idea" || phrasesLoaded) return;
    backend.riskflow
      .getPhrases()
      .then((res) => {
        setPhrases(res.phrases);
        setPhrasesLoaded(true);
      })
      .catch(() => setPhrasesLoaded(true));
  }, [activeSection, phrasesLoaded, backend.riskflow]);

  // Load hot times when expanded
  useEffect(() => {
    if (!showHotTimes) return;
    setHotTimesLoaded(false);
    backend.stickyBulletin
      .getHotTimes(hotTimesByDay)
      .then((res) => {
        setHotTimes(res.hotTimes);
        setHotTimesLoaded(true);
      })
      .catch(() => setHotTimesLoaded(true));
  }, [showHotTimes, hotTimesByDay, backend.stickyBulletin]);

  // Click outside handler
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose, anchorRef]);

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

  // ─── Antilag handlers ───
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

  // Quick Clock — one-tap antilag logging
  const handleQuickClock = async () => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const dayOfWeek = now.getDay();
    const instrument = selectedSymbol.symbol || "ES";

    setQuickClockPulse(true);
    setTimeout(() => setQuickClockPulse(false), 600);

    try {
      await backend.stickyBulletin.addAntilagTime({
        time,
        dayOfWeek,
        instrument,
        notes: "",
      });
      setAntilagTimes((prev) => [
        {
          time,
          dayOfWeek,
          instrument,
          notes: "",
          createdAt: now.toISOString(),
        },
        ...prev,
      ]);
      addToast(
        `${time} ${DAY_LABELS[dayOfWeek]} ${instrument}`,
        "success",
        "Antilag clocked",
        undefined,
        "top-right",
      );
    } catch {
      addToast("Failed to log", "error");
    }
  };

  // ─── Catalyst Watch handlers ───
  const handleAddPhrase = async () => {
    if (!newPhrase.trim()) return;
    setPhraseSubmitting(true);
    setBiasWarning("");
    try {
      const res = await backend.riskflow.addPhrase({
        phrase: newPhrase,
        matchType: phraseMatchType,
        repeating: phraseRepeating,
      });
      setPhrases((prev) => [res.phrase, ...prev]);
      setNewPhrase("");
      if (res.removedBias.length > 0) {
        setBiasWarning(`Removed bias: ${res.removedBias.join(", ")}`);
        setTimeout(() => setBiasWarning(""), 4000);
      }
      addToast(
        `Watching: "${res.phrase.phrase}"`,
        "success",
        undefined,
        undefined,
        "top-right",
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add";
      addToast(msg, "error");
    } finally {
      setPhraseSubmitting(false);
    }
  };

  const handleDeletePhrase = async (id: number) => {
    try {
      await backend.riskflow.deletePhrase(id);
      setPhrases((prev) => prev.filter((p) => p.id !== id));
    } catch {
      addToast("Failed to remove", "error");
    }
  };

  const sections = [
    { id: "idea" as const, icon: Crosshair, label: "Catalyst" },
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
          {/* ═══ Section 1: Catalyst Watch (inline) ═══ */}
          {activeSection === "idea" && (
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
                  value={newPhrase}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddPhrase();
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
                        onClick={() => setPhraseMatchType(t)}
                        className="flex-1 py-1 text-[9px] uppercase tracking-wide transition-colors"
                        style={{
                          color:
                            phraseMatchType === t
                              ? "var(--fintheon-accent)"
                              : "var(--fintheon-muted)",
                          background:
                            phraseMatchType === t
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
                        onClick={() => setPhraseRepeating(r)}
                        className="flex-1 py-1 text-[9px] uppercase tracking-wide transition-colors"
                        style={{
                          color:
                            phraseRepeating === r
                              ? "var(--fintheon-accent)"
                              : "var(--fintheon-muted)",
                          background:
                            phraseRepeating === r
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
                  onClick={handleAddPhrase}
                  disabled={phraseSubmitting || !newPhrase.trim()}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-medium tracking-wide uppercase transition-all duration-200 disabled:opacity-40"
                  style={{
                    color: "var(--fintheon-accent)",
                    background:
                      "color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
                  }}
                >
                  <Plus className="w-3 h-3" />
                  {phraseSubmitting ? "Adding..." : "Add Catalyst Watch"}
                </button>
              </div>

              {/* Bias warning */}
              {biasWarning && (
                <p
                  className="text-[10px] italic animate-in fade-in duration-200"
                  style={{ color: "var(--fintheon-bearish, #EF4444)" }}
                >
                  {biasWarning}
                </p>
              )}

              {/* Active phrases list */}
              {phrases.length > 0 ? (
                <div className="space-y-1">
                  <span
                    className="text-[9px] uppercase tracking-widest"
                    style={{ color: "var(--fintheon-muted)" }}
                  >
                    Active watches
                  </span>
                  {phrases.map((p) => (
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
                        onClick={() => handleDeletePhrase(p.id)}
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
          {activeSection === "antilag" && (
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
                  onClick={() => setShowQuickClock(!showQuickClock)}
                  className="text-[8px] px-1.5 py-0.5 rounded transition-colors"
                  style={{
                    color: showQuickClock
                      ? "var(--fintheon-accent)"
                      : "var(--fintheon-muted)",
                    background: showQuickClock
                      ? "color-mix(in srgb, var(--fintheon-accent) 10%, transparent)"
                      : "transparent",
                  }}
                >
                  {showQuickClock ? "Hide" : "Show"} Quick
                </button>
              </div>

              {/* Quick Clock — one-tap */}
              {showQuickClock && (
                <button
                  onClick={handleQuickClock}
                  className="w-full flex items-center justify-center gap-2.5 py-3 rounded-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]"
                  style={{
                    background: quickClockPulse
                      ? "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)"
                      : "color-mix(in srgb, var(--fintheon-accent) 8%, transparent)",
                    border: `1px solid color-mix(in srgb, var(--fintheon-accent) ${quickClockPulse ? "40" : "20"}%, transparent)`,
                    boxShadow: quickClockPulse
                      ? "0 0 12px color-mix(in srgb, var(--fintheon-accent) 15%, transparent)"
                      : "none",
                    transition: "all 0.3s ease",
                  }}
                >
                  <Clock
                    className="w-5 h-5"
                    style={{
                      color: "var(--fintheon-accent)",
                      transform: quickClockPulse ? "scale(1.2)" : "scale(1)",
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
                      {selectedSymbol.symbol || "ES"} ·{" "}
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
                  onClick={() => setShowHotTimes(!showHotTimes)}
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
                  {showHotTimes ? (
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

                {showHotTimes && (
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
                        onClick={() => setHotTimesByDay(!hotTimesByDay)}
                        className="text-[8px] px-1.5 py-0.5 rounded transition-colors"
                        style={{
                          color: hotTimesByDay
                            ? "#F97316"
                            : "var(--fintheon-muted)",
                          background: hotTimesByDay
                            ? "color-mix(in srgb, #F97316 10%, transparent)"
                            : "transparent",
                        }}
                      >
                        {hotTimesByDay ? "By Day" : "All Days"}
                      </button>
                    </div>

                    {!hotTimesLoaded ? (
                      <p
                        className="text-[10px] text-center py-2"
                        style={{ color: "var(--fintheon-muted)" }}
                      >
                        Loading...
                      </p>
                    ) : hotTimes.length === 0 ? (
                      <p
                        className="text-[10px] text-center py-2"
                        style={{ color: "var(--fintheon-muted)" }}
                      >
                        No data yet. Log antilag times to see patterns.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {hotTimes.map((ht, i) => {
                          const maxCount = hotTimes[0]?.count || 1;
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

              {/* Recent entries */}
              {antilagTimes.length > 0 && (
                <div className="space-y-1">
                  <span
                    className="text-[9px] uppercase tracking-widest"
                    style={{ color: "var(--fintheon-muted)" }}
                  >
                    Recent observations
                  </span>
                  {antilagTimes.slice(0, 6).map((entry, i) => (
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
                    onBlur={() => setTimeout(() => setEditingEvent(false), 300)}
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

          {/* ═══ Section 4: Trading Notes ═══ */}
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
                    onBlur={() => setTimeout(() => setEditingNotes(false), 300)}
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
    </div>,
    document.body,
  );
}
