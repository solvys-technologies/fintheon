// [claude-code 2026-03-11] Native Economic Calendar — replaced TradingView iframe (X-Frame-Options blocked)
// [claude-code 2026-03-12] Reverted to TradingView widget embed — full-tab with importance filter
// [claude-code 2026-04-26] S46: Week-snap re-mount + Friday-close rollover + Desk Queue badge.
// The widget remounts whenever tradingWeekKey() advances (Mon-Fri normal week,
// Friday after 16:00 ET advances to next Monday), guaranteeing the embed always
// boots into the current trading week with our default filters re-applied.
// The badge polls /api/desk/calendar/status to surface ingest counts from the
// Electron .ics interceptor.
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Filter, Inbox } from "lucide-react";

type ImportanceFilter = "all" | "medium" | "high";

const FILTER_MAP: Record<ImportanceFilter, string> = {
  all: "-1,0,1",
  medium: "0,1",
  high: "1",
};

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

// Returns the ISO date of the Monday that anchors the current trading week.
// Mon-Fri before 16:00 ET → this week's Monday. Fri after 16:00 ET, Sat, Sun →
// next Monday. Used as a React key so the embed cleanly remounts on rollover.
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
  const get = (t: string) => etParts.find((p) => p.type === t)?.value ?? "";
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
        : 3 // Friday → +3 days = next Monday
    : -((dow + 6) % 7); // back to current Monday
  const target = new Date(noonUtc + offsetToMonday * 86_400_000);
  return target.toISOString().slice(0, 10);
}

interface DeskQueueStatus {
  count: number;
  last_ingest_at: string | null;
}

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

export function EconCalendar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [importanceFilter, setImportanceFilter] =
    useState<ImportanceFilter>("all");
  const [weekKey, setWeekKey] = useState<string>(() => tradingWeekKey());
  const [queue, setQueue] = useState<DeskQueueStatus>({
    count: 0,
    last_ingest_at: null,
  });

  // Roll the week key forward automatically — checks every minute, only
  // re-renders when tradingWeekKey() actually flips.
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = tradingWeekKey();
      setWeekKey((prev) => (prev === next ? prev : next));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Desk Queue status poll — reflects what the Electron .ics interceptor
  // has captured from TV's "Add to Calendar" clicks.
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
    const container = containerRef.current;
    if (!container) return;

    while (container.firstChild) container.removeChild(container.firstChild);

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.width = "100%";
    widgetDiv.style.height = "100%";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
    script.async = true;
    script.textContent = JSON.stringify({
      colorTheme: "dark",
      isTransparent: true,
      width: "100%",
      height: "100%",
      locale: "en",
      importanceFilter: FILTER_MAP[importanceFilter],
      countryFilter: "us",
    });
    container.appendChild(script);

    return () => {
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [importanceFilter, weekKey]);

  return (
    <div className="h-full flex flex-col bg-[var(--fintheon-bg)]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="w-4 h-4 text-[var(--fintheon-accent)]" />
            <h2 className="text-sm font-semibold text-[var(--fintheon-accent)]">
              Economic Calendar
            </h2>
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">
              TradingView
            </span>
          </div>
          <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-1 bg-zinc-900/50 rounded px-1 py-0.5">
              <Filter className="w-3 h-3 text-zinc-500" />
              {(["all", "medium", "high"] as ImportanceFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setImportanceFilter(f)}
                  className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider transition-colors ${
                    importanceFilter === f
                      ? "bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {f === "all" ? "All" : f === "medium" ? "Med+" : "High"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* TradingView Widget */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          key={weekKey}
          ref={containerRef}
          className="tradingview-widget-container w-full h-full"
        />
      </div>
    </div>
  );
}
