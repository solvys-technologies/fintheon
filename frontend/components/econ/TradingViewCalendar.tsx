// [claude-code 2026-04-27] S46.4: Restore the full TradingView Economic
// Calendar iframe in the CALENDAR navtab. Lightweight script widget
// (EconCalendar.tsx) stays around for surfaces that consume the events
// context, but the navtab now renders the live TV page so TP can use the
// "Add to Calendar" CTA. Electron intercepts the resulting .ics download
// (electron/main.cjs:586+), POSTs to /api/desk/calendar/ingest-ics, and
// emits desk-calendar:saving / :saved / :failed IPC events that drive the
// green status text and the success toast — no Google Calendar window,
// no chooser dialog, no app-leaving navigation.
import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Inbox, Loader2 } from "lucide-react";
import { EmbeddedBrowserFrame } from "../layout/EmbeddedBrowserFrame";
import { useToast } from "../../contexts/ToastContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const TRADINGVIEW_CALENDAR_URL = "https://www.tradingview.com/calendar/";

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

export function TradingViewCalendar() {
  const { addToast } = useToast();
  const [queue, setQueue] = useState<DeskQueueStatus>({
    count: 0,
    last_ingest_at: null,
  });
  const [saveState, setSaveState] = useState<SaveState>({ phase: "idle" });

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
          title="TradingView Economic Calendar"
          src={TRADINGVIEW_CALENDAR_URL}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
