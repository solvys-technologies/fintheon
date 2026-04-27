// [claude-code 2026-04-27] S46.4: Restore the full TradingView Economic
// Calendar iframe in the CALENDAR navtab. The lightweight script widget
// (EconCalendar.tsx) stays around for surfaces that consume the events
// context, but the navtab now renders the live TV page so TP can use the
// "Add to Calendar" CTA. Electron intercepts the resulting .ics download
// (electron/main.cjs:586+) and POSTs it to /api/desk/calendar/ingest-ics.
// Header keeps the Desk Queue badge so ingest activity is visible.
import { useEffect, useState } from "react";
import { CalendarDays, Inbox } from "lucide-react";
import { EmbeddedBrowserFrame } from "../layout/EmbeddedBrowserFrame";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const TRADINGVIEW_CALENDAR_URL = "https://www.tradingview.com/calendar/";

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

export function TradingViewCalendar() {
  const [queue, setQueue] = useState<DeskQueueStatus>({
    count: 0,
    last_ingest_at: null,
  });

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

  return (
    <div className="h-full w-full flex flex-col bg-[var(--fintheon-bg)]">
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
          title="TradingView Economic Calendar"
          src={TRADINGVIEW_CALENDAR_URL}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
