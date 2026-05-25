// [claude-code 2026-04-10] Extracted from StickyBulletin.tsx — all state + effects + handlers
import { useState, useEffect, useRef, useCallback } from "react";
import { useBackend } from "../lib/backend";
import { useToast } from "../contexts/ToastContext";
import { useSettings } from "../contexts/SettingsContext";
import type { StickyBulletinData } from "../lib/services/editor";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export { DAY_LABELS };

export type SectionId = "idea" | "antilag" | "event" | "notes" | "daycard";

export interface HotTimeEntry {
  bucket: string;
  dayOfWeek?: number;
  count: number;
  instruments: string[];
}

export function useStickyBulletin(
  open: boolean,
  anchorRef: React.RefObject<HTMLButtonElement | null>,
) {
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

  // Hot Times state
  const [showHotTimes, setShowHotTimes] = useState(false);
  const [hotTimesLoaded, setHotTimesLoaded] = useState(false);
  const [hotTimesByDay, setHotTimesByDay] = useState(false);
  const [hotTimes, setHotTimes] = useState<HotTimeEntry[]>([]);

  // Quick Clock state
  const [showQuickClock, setShowQuickClock] = useState(true);
  const [quickClockPulse, setQuickClockPulse] = useState(false);

  // UI state
  const [activeSection, setActiveSection] = useState<SectionId>("notes");
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
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, anchorRef]);

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

  return {
    // Position & refs
    popupPos,
    panelRef,

    // Section navigation
    activeSection,
    setActiveSection,

    // Antilag
    antilagTimes,
    newAntilagTime,
    setNewAntilagTime,
    newAntilagDay,
    setNewAntilagDay,
    newAntilagInstrument,
    setNewAntilagInstrument,
    newAntilagNotes,
    setNewAntilagNotes,
    handleAddAntilag,

    // Quick Clock
    showQuickClock,
    setShowQuickClock,
    quickClockPulse,
    handleQuickClock,

    // Hot Times
    showHotTimes,
    setShowHotTimes,
    hotTimesLoaded,
    hotTimesByDay,
    setHotTimesByDay,
    hotTimes,

    // Event of the Week
    eventOfWeek,
    editingEvent,
    setEditingEvent,
    handleEventChange,

    // Notes
    tradingNotes,
    editingNotes,
    setEditingNotes,
    handleNotesChange,

    // Settings
    selectedSymbol,
  };
}
