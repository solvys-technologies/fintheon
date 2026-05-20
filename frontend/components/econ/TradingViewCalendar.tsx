// [codex 2026-05-20] Main Calendar must use TradingView's full calendar page,
// not the lightweight embeddable widget, so Economic/Earnings/Revenue/Dividend/
// IPO tabs and all country filters stay available. The frame is keyed by the
// current trading week so stale prior-week sessions snap back on week rollover,
// while TabRenderer keeps the frame mounted during same-session tab switches.
import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Inbox, Loader2 } from "lucide-react";
import { EmbeddedBrowserFrame } from "../layout/EmbeddedBrowserFrame";
import { useToast } from "../../contexts/ToastContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const TRADINGVIEW_CALENDAR_URL =
  "https://www.tradingview.com/economic-calendar/";

interface DeskQueueStatus {
  count: number;
  last_ingest_at: string | null;
}

type SaveState =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "saved"; title: string | null }
  | { phase: "failed"; reason: string };

function formatRelative(iso: string | null): string {
  if (!iso) return "no events yet";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function tradingWeekKey(now: Date = new Date()): string {
  const etParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) =>
    etParts.find((part) => part.type === type)?.value ?? "";
  const weekday = get("weekday");
  const hourEt = Number(get("hour"));
  const yyyy = Number(get("year"));
  const mm = Number(get("month"));
  const dd = Number(get("day"));
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = dayMap[weekday] ?? new Date(yyyy, mm - 1, dd).getDay();
  const advancedToNextWeek =
    dow === 0 || dow === 6 || (dow === 5 && hourEt >= 16);
  const noonUtc = Date.UTC(yyyy, mm - 1, dd, 12);
  const offsetToMonday = advancedToNextWeek
    ? dow === 0
      ? 1
      : dow === 6
        ? 2
        : 3
    : -((dow + 6) % 7);
  const target = new Date(noonUtc + offsetToMonday * 86_400_000);
  return target.toISOString().slice(0, 10);
}

export function TradingViewCalendar() {
  const { addToast } = useToast();
  const [queue, setQueue] = useState<DeskQueueStatus>({
    count: 0,
    last_ingest_at: null,
  });
  const [saveState, setSaveState] = useState<SaveState>({ phase: "idle" });
  const [weekKey, setWeekKey] = useState<string>(() => tradingWeekKey());

  const refreshQueue = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/desk/calendar/status`);
      if (!res.ok) return;
      const json = (await res.json()) as DeskQueueStatus;
      setQueue(json);
    } catch {
      /* offline tolerant */
    }
  };

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/desk/calendar/status`);
        if (!res.ok) return;
        const json = (await res.json()) as DeskQueueStatus;
        if (!cancelled) setQueue(json);
      } catch {
        /* offline tolerant */
      }
    };
    pull();
    const id = window.setInterval(pull, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = tradingWeekKey();
      setWeekKey((prev) => (prev === next ? prev : next));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const bridge = window.electron?.deskCalendar;
    if (!bridge) return;
    bridge.onSaving(() => {
      setSaveState({ phase: "saving" });
    });
    bridge.onSaved((payload) => {
      setSaveState({ phase: "saved", title: payload.title });
      addToast(
        payload.ingested > 0
          ? `Added to desk queue${payload.title ? ` · ${payload.title}` : ""}`
          : "Event already in desk queue",
        "success",
      );
      void refreshQueue();
      window.setTimeout(() => {
        setSaveState({ phase: "idle" });
      }, 4000);
    });
    bridge.onFailed((payload) => {
      setSaveState({ phase: "failed", reason: payload.reason });
      addToast("Save failed", "error", payload.reason);
      window.setTimeout(() => {
        setSaveState({ phase: "idle" });
      }, 6000);
    });
    return () => {
      bridge.onSaving(null);
      bridge.onSaved(null);
      bridge.onFailed(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full w-full flex flex-col bg-black">
      <div className="flex-shrink-0 px-4 py-3 bg-black">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="w-4 h-4 text-[var(--fintheon-accent)]" />
            <h2 className="text-sm font-semibold text-[var(--fintheon-accent)]">
              Econ Calendar
            </h2>
            {saveState.phase === "saving" && (
              <span className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving event to desk queue…
              </span>
            )}
            {saveState.phase === "saved" && (
              <span className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                Saved
                {saveState.title ? ` · ${saveState.title}` : ""}
              </span>
            )}
            {saveState.phase === "failed" && (
              <span className="ml-2 text-[11px] font-medium text-red-400">
                Save failed · {saveState.reason}
              </span>
            )}
          </div>
          <div
            className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-zinc-500 px-2 py-0.5 rounded border border-zinc-800/60"
            title={`Desk Queue · ${formatRelative(queue.last_ingest_at)}`}
          >
            <Inbox className="w-3 h-3" />
            <span className="text-[var(--fintheon-accent)] tabular-nums">
              {queue.count}
            </span>
            <span>queued</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500 normal-case tracking-normal">
              {formatRelative(queue.last_ingest_at)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <EmbeddedBrowserFrame
          key={weekKey}
          title="TradingView Economic Calendar"
          src={TRADINGVIEW_CALENDAR_URL}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
