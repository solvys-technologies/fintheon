// [claude-code 2026-04-19] TP: read-only until tap (bigger target), larger textarea rows,
//   auto-save fires 900ms after last keystroke (keeps existing auth + activity signaling).
// [claude-code 2026-04-16] S20: StickyBulletin — auth headers, haptic-gated, activity signals
// [claude-code 2026-04-17] Flush pending saves on close, re-fetch fresh on every open
import { useState, useCallback, useEffect, useRef } from "react";
import {
  Crosshair,
  Clock,
  CalendarDays,
  StickyNote,
  X,
  Zap,
  TrendingUp,
} from "lucide-react";
import { MobileBulletinDayCard } from "./MobileBulletinDayCard";
// [claude-code 2026-04-19] Use SnapSheet so the bulletin rises under the dash fuse row,
//   matching the notification drawer's sizing per TP.
import { SnapSheet } from "../shared/SnapSheet";
import { useAuth } from "../../contexts/AuthContext";
import { useHaptic } from "../../hooks/useHaptic";
import { useActivityStatus } from "../../contexts/ActivityStatusContext";

const API_BASE = import.meta.env.VITE_API_URL || "";
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const INSTRUMENTS = ["ES", "NQ", "YM", "RTY", "CL", "GC", "SI", "BTC"];

type SectionId = "catalyst" | "antilag" | "event" | "notes" | "daycard";

interface AntilagEntry {
  time: string;
  dayOfWeek: number;
  instrument: string;
  notes: string;
  createdAt: string;
}

interface WatchPhrase {
  id: number;
  phrase: string;
  matchType: "contains" | "exact";
  repeating: boolean;
  matchCount: number;
}

const SECTIONS: { id: SectionId; icon: typeof Crosshair; label: string }[] = [
  { id: "catalyst", icon: Crosshair, label: "Catalyst" },
  { id: "antilag", icon: Clock, label: "Antilag" },
  { id: "event", icon: CalendarDays, label: "Event" },
  { id: "notes", icon: StickyNote, label: "Notes" },
  { id: "daycard", icon: TrendingUp, label: "Day Card" },
];

interface MobileBulletinProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileBulletin({ isOpen, onClose }: MobileBulletinProps) {
  const { getAccessToken } = useAuth();
  const vibrate = useHaptic();
  const { setActivity } = useActivityStatus();
  const [section, setSection] = useState<SectionId>("notes");
  const [loaded, setLoaded] = useState(false);

  // Notes + Event
  const [tradingNotes, setTradingNotes] = useState("");
  const [eventOfWeek, setEventOfWeek] = useState("");
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesDirty = useRef(false);
  const eventDirty = useRef(false);
  const latestNotes = useRef("");
  const latestEvent = useRef("");

  // Antilag
  const [antilagTimes, setAntilagTimes] = useState<AntilagEntry[]>([]);
  const [newTime, setNewTime] = useState("");
  const [newDay, setNewDay] = useState(new Date().getDay());
  const [newInstrument, setNewInstrument] = useState("ES");
  const [quickPulse, setQuickPulse] = useState(false);

  // Catalyst
  const [phrases, setPhrases] = useState<WatchPhrase[]>([]);
  const [phrasesLoaded, setPhrasesLoaded] = useState(false);
  const [newPhrase, setNewPhrase] = useState("");
  const [matchType, setMatchType] = useState<"contains" | "exact">("contains");
  const [repeating, setRepeating] = useState(false);

  // Re-fetch every time bulletin opens (no stale cache)
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/api/sticky-bulletin`, {
          headers,
          cache: "no-store",
        });
        const json = await res.json();
        const d = json.data ?? json;
        setTradingNotes(d.tradingNotes || "");
        setEventOfWeek(d.eventOfWeek || "");
        setAntilagTimes(d.antilagTimes || []);
      } catch {}
      setLoaded(true);
    })();
  }, [isOpen, getAccessToken]);

  // Load phrases when catalyst tab opens
  useEffect(() => {
    if (section !== "catalyst" || phrasesLoaded) return;
    (async () => {
      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/api/riskflow/phrases`, {
          headers,
          cache: "no-store",
        });
        const json = await res.json();
        setPhrases(json.phrases || []);
      } catch {}
      setPhrasesLoaded(true);
    })();
  }, [section, phrasesLoaded, getAccessToken]);

  // Auto-save notes with auth + activity signal
  const saveField = useCallback(
    async (field: string, value: string) => {
      setActivity("loading");
      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        await fetch(`${API_BASE}/api/sticky-bulletin`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ [field]: value }),
        });
        vibrate(6);
        setActivity("success", 1500);
      } catch {
        setActivity("idle");
      }
    },
    [getAccessToken, vibrate, setActivity],
  );

  const handleNotesChange = useCallback(
    (val: string) => {
      setTradingNotes(val);
      latestNotes.current = val;
      notesDirty.current = true;
      if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
      notesSaveTimer.current = setTimeout(() => {
        saveField("tradingNotes", val);
        notesDirty.current = false;
      }, 900);
    },
    [saveField],
  );

  const handleEventChange = useCallback(
    (val: string) => {
      setEventOfWeek(val);
      latestEvent.current = val;
      eventDirty.current = true;
      if (eventSaveTimer.current) clearTimeout(eventSaveTimer.current);
      eventSaveTimer.current = setTimeout(() => {
        saveField("eventOfWeek", val);
        eventDirty.current = false;
      }, 900);
    },
    [saveField],
  );

  // Flush pending saves immediately when bulletin closes
  useEffect(() => {
    if (isOpen) return;
    if (notesSaveTimer.current) {
      clearTimeout(notesSaveTimer.current);
      notesSaveTimer.current = null;
    }
    if (eventSaveTimer.current) {
      clearTimeout(eventSaveTimer.current);
      eventSaveTimer.current = null;
    }
    if (notesDirty.current) {
      saveField("tradingNotes", latestNotes.current);
      notesDirty.current = false;
    }
    if (eventDirty.current) {
      saveField("eventOfWeek", latestEvent.current);
      eventDirty.current = false;
    }
  }, [isOpen, saveField]);

  // Quick Clock
  const handleQuickClock = useCallback(async () => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const dayOfWeek = now.getDay();
    setQuickPulse(true);
    setTimeout(() => setQuickPulse(false), 600);
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch(`${API_BASE}/api/sticky-bulletin/antilag`, {
        method: "POST",
        headers,
        body: JSON.stringify({ time, dayOfWeek, instrument: "ES", notes: "" }),
      });
      setAntilagTimes((prev) => [
        {
          time,
          dayOfWeek,
          instrument: "ES",
          notes: "",
          createdAt: now.toISOString(),
        },
        ...prev,
      ]);
      vibrate(15);
    } catch {}
  }, [getAccessToken, vibrate]);

  // Add antilag manually
  const handleAddAntilag = useCallback(async () => {
    if (!newTime) return;
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch(`${API_BASE}/api/sticky-bulletin/antilag`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          time: newTime,
          dayOfWeek: newDay,
          instrument: newInstrument,
          notes: "",
        }),
      });
      setAntilagTimes((prev) => [
        {
          time: newTime,
          dayOfWeek: newDay,
          instrument: newInstrument,
          notes: "",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setNewTime("");
      vibrate(10);
    } catch {}
  }, [newTime, newDay, newInstrument, getAccessToken, vibrate]);

  // Add catalyst phrase
  const handleAddPhrase = useCallback(async () => {
    if (!newPhrase.trim()) return;
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/riskflow/phrases`, {
        method: "POST",
        headers,
        body: JSON.stringify({ phrase: newPhrase, matchType, repeating }),
      });
      const json = await res.json();
      if (json.phrase) setPhrases((prev) => [json.phrase, ...prev]);
      setNewPhrase("");
      vibrate(10);
    } catch {}
  }, [newPhrase, matchType, repeating, getAccessToken, vibrate]);

  // Delete catalyst phrase
  const handleDeletePhrase = useCallback(
    async (id: number) => {
      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        await fetch(`${API_BASE}/api/riskflow/phrases/${id}`, {
          method: "DELETE",
          headers,
        });
        setPhrases((prev) => prev.filter((p) => p.id !== id));
      } catch {}
    },
    [getAccessToken],
  );

  return (
    <SnapSheet isOpen={isOpen} onClose={onClose} title="BULLETIN">
      {/* Section tabs */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 16,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {SECTIONS.map(({ id, icon: Icon, label }) => {
          const active = section === id;
          return (
            <button
              key={id}
              onClick={() => setSection(id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                padding: "8px 0",
                background: "transparent",
                border: "none",
                borderBottom: active
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <Icon
                size={16}
                color={active ? "var(--accent)" : "var(--text-secondary)"}
              />
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 9,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {section === "notes" && (
        <TapToEditField
          label="TRADING NOTES"
          value={tradingNotes}
          onChange={handleNotesChange}
          placeholder="Tap to add trading notes..."
          rows={14}
        />
      )}

      {section === "event" && (
        <TapToEditField
          label="EVENT OF THE WEEK"
          value={eventOfWeek}
          onChange={handleEventChange}
          placeholder="Tap to log the key event to watch..."
          rows={10}
        />
      )}

      {section === "antilag" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Quick Clock */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={handleQuickClock}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "var(--accent)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transform: quickPulse ? "scale(1.2)" : "scale(1)",
                transition: "transform 0.3s ease-out",
              }}
            >
              <Zap size={20} color="var(--black, #000)" />
            </button>
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 11,
                color: "var(--text-secondary)",
                letterSpacing: "0.04em",
              }}
            >
              TAP TO LOG NOW
            </span>
          </div>

          {/* Manual entry */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <select
              value={newDay}
              onChange={(e) => setNewDay(Number(e.target.value))}
              style={{ ...inputStyle, width: 70 }}
            >
              {DAY_LABELS.map((l, i) => (
                <option key={i} value={i}>
                  {l}
                </option>
              ))}
            </select>
            <select
              value={newInstrument}
              onChange={(e) => setNewInstrument(e.target.value)}
              style={{ ...inputStyle, width: 60 }}
            >
              {INSTRUMENTS.map((inst) => (
                <option key={inst} value={inst}>
                  {inst}
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleAddAntilag} style={actionButtonStyle}>
            [LOG ANTILAG]
          </button>

          {/* Recent entries */}
          {antilagTimes.length > 0 && (
            <div>
              <SectionLabel>RECENT</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {antilagTimes.slice(0, 8).map((entry, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 8,
                      fontFamily: "var(--font-data)",
                      fontSize: 11,
                      color: "var(--text-primary)",
                      padding: "6px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span>{entry.time}</span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      {DAY_LABELS[entry.dayOfWeek]}
                    </span>
                    <span style={{ color: "var(--accent)" }}>
                      {entry.instrument}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {section === "daycard" && <MobileBulletinDayCard />}

      {section === "catalyst" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Add phrase */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newPhrase}
              onChange={(e) => setNewPhrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPhrase()}
              placeholder="Watch for..."
              maxLength={120}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={handleAddPhrase} style={actionButtonStyle}>
              [ADD]
            </button>
          </div>

          {/* Match type + repeat toggles */}
          <div style={{ display: "flex", gap: 12 }}>
            <TogglePill
              label={matchType === "contains" ? "CONTAINS" : "EXACT"}
              on={matchType === "exact"}
              onToggle={() =>
                setMatchType((p) => (p === "contains" ? "exact" : "contains"))
              }
            />
            <TogglePill
              label={repeating ? "REPEAT" : "ONCE"}
              on={repeating}
              onToggle={() => setRepeating((p) => !p)}
            />
          </div>

          {/* Active watches */}
          {phrases.length === 0 ? (
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 11,
                color: "var(--text-disabled)",
                textAlign: "center",
                padding: "20px 0",
              }}
            >
              [NO ACTIVE WATCHES]
            </span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {phrases.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <Crosshair size={12} color="var(--accent)" />
                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 13,
                        color: "var(--text-primary)",
                      }}
                    >
                      {p.phrase}
                    </span>
                    {p.matchCount > 0 && (
                      <span
                        style={{
                          fontFamily: "var(--font-data)",
                          fontSize: 9,
                          color: "var(--accent)",
                          background: "rgba(199,159,74,0.15)",
                          padding: "1px 5px",
                          borderRadius: 3,
                        }}
                      >
                        {p.matchCount}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeletePhrase(p.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 8,
                      cursor: "pointer",
                      minWidth: 36,
                      minHeight: 36,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={14} color="var(--text-disabled)" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </SnapSheet>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-data)",
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--text-secondary)",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function TogglePill({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        fontFamily: "var(--font-data)",
        fontSize: 10,
        letterSpacing: "0.06em",
        color: on ? "var(--accent)" : "var(--text-secondary)",
        background: "transparent",
        border: `1px solid ${on ? "var(--accent)" : "var(--border-visible)"}`,
        borderRadius: 4,
        padding: "4px 10px",
        cursor: "pointer",
        minHeight: 32,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {label}
    </button>
  );
}

/** Tap-to-edit multiline field — renders as a read-only glass plate until tapped,
 *  then flips to an editable textarea that auto-saves 900ms after last keystroke.
 *  Blur returns to read-only. Keeps room for double the content TP was seeing. */
function TapToEditField({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  rows: number;
}) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const enterEdit = useCallback(() => {
    setEditing(true);
    // Focus on the next frame so the textarea has mounted.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, []);

  const leaveEdit = useCallback(() => setEditing(false), []);

  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      {editing ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={leaveEdit}
          placeholder={placeholder}
          rows={rows}
          style={editTextareaStyle}
        />
      ) : (
        <button
          type="button"
          onClick={enterEdit}
          style={{ ...readonlyPlateStyle, minHeight: `${rows * 24 + 20}px` }}
          aria-label={`Edit ${label.toLowerCase()}`}
        >
          {value ? (
            <span style={readonlyTextStyle}>{value}</span>
          ) : (
            <span style={readonlyPlaceholderStyle}>{placeholder}</span>
          )}
          <span style={tapHintStyle}>[TAP TO EDIT]</span>
        </button>
      )}
    </div>
  );
}

const editTextareaStyle: React.CSSProperties = {
  width: "100%",
  background: "color-mix(in srgb, var(--accent) 4%, transparent)",
  border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
  borderRadius: 10,
  padding: "12px 14px",
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--text-primary)",
  lineHeight: 1.55,
  resize: "none",
  outline: "none",
  boxSizing: "border-box",
  backdropFilter: "blur(16px) saturate(1.3)",
  WebkitBackdropFilter: "blur(16px) saturate(1.3)",
  transition: "border-color 200ms ease, background 200ms ease",
};

const readonlyPlateStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  background: "color-mix(in srgb, var(--accent) 2%, transparent)",
  border: "1px solid color-mix(in srgb, var(--accent) 12%, transparent)",
  borderRadius: 10,
  padding: "12px 14px",
  fontFamily: "var(--font-body)",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
  backdropFilter: "blur(14px) saturate(1.25)",
  WebkitBackdropFilter: "blur(14px) saturate(1.25)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  transition: "border-color 200ms ease, background 200ms ease",
};

const readonlyTextStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 15,
  color: "var(--text-primary)",
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
};

const readonlyPlaceholderStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--text-disabled)",
  lineHeight: 1.55,
};

const tapHintStyle: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "color-mix(in srgb, var(--accent) 60%, transparent)",
  alignSelf: "flex-end",
};

const inputStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border-visible)",
  borderRadius: 6,
  padding: "8px 10px",
  fontFamily: "var(--font-data)",
  fontSize: 12,
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
};

const actionButtonStyle: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "var(--accent)",
  background: "transparent",
  border: "1px solid var(--accent)",
  borderRadius: 4,
  padding: "8px 16px",
  cursor: "pointer",
  minHeight: 40,
  WebkitTapHighlightColor: "transparent",
};
