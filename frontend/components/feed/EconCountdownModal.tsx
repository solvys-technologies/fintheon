// [claude-code 2026-04-26] Added `fintheon:econ-mock-countdown` listener so
// Developer settings can fire a 1-min mock card without backend involvement.
// The mock event flows the same code path as a real /api/econ/active-watch
// row, so the test verifies the modal end-to-end (fade-in, tick-down,
// printed-state cross-fade triggered by a mock SSE frame after countdown).
// [claude-code 2026-04-24] S34-T8: Econ countdown modal.
// Fades in at T-5min, Doto mm:ss countdown, cross-fades to Actual/Forecast on
// SSE econ-print arrival, fades out 20s after print (or 15min after scheduled
// if no print lands). No glass, no box-shadow, no gradient, no emoji — flat
// #050402 + 1px #c79f4a border per feedback_no_glass_effects.

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const POLL_INTERVAL_MS = 30_000;
const VISIBLE_WINDOW_MS = 5 * 60 * 1000; // T-5min gate
const POST_PRINT_HOLD_MS = 20_000; // 20s visible after actual
const STALE_WINDOW_MS = 15 * 60 * 1000; // mark missed after T+15min
const MAX_STACK = 3;

type Status = "upcoming" | "printed" | "missed";

interface ActiveWatchEvent {
  id: string;
  eventName: string;
  country: string | null;
  category: string | null;
  scheduledAt: string;
  forecast: number | null;
  previous: number | null;
  actual: number | null;
  status: Status;
}

interface EconPrintFrame {
  eventName: string;
  actual: number;
  forecast?: number | null;
  previous?: number | null;
  surprisePercent?: number | null;
  beatMiss: "beat" | "miss" | "inline";
  printedAt: string;
}

interface CardState extends ActiveWatchEvent {
  printedAt?: string;
  beatMiss?: "beat" | "miss" | "inline";
  surprisePercent?: number | null;
  flashKey: number;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function useEconActiveWatch(): ActiveWatchEvent[] {
  const [events, setEvents] = useState<ActiveWatchEvent[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchWatch = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/econ/active-watch`);
        if (!res.ok) return;
        const json = (await res.json()) as { events?: ActiveWatchEvent[] };
        if (mounted && Array.isArray(json.events)) setEvents(json.events);
      } catch {
        // Silent — endpoint may not be live yet in dev.
      }
    };
    void fetchWatch();
    const id = window.setInterval(fetchWatch, POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  return events;
}

function useEconPrintStream(onPrint: (frame: EconPrintFrame) => void): void {
  const onPrintRef = useRef(onPrint);
  onPrintRef.current = onPrint;

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/riskflow/stream`);
    const handler = (ev: MessageEvent) => {
      try {
        const frame = JSON.parse(ev.data) as EconPrintFrame;
        if (frame && typeof frame.eventName === "string") {
          onPrintRef.current(frame);
        }
      } catch {
        // ignore malformed frames
      }
    };
    es.addEventListener("econ-print", handler as EventListener);
    return () => {
      es.removeEventListener("econ-print", handler as EventListener);
      es.close();
    };
  }, []);
}

function useTick(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function EconCountdownModal() {
  const active = useEconActiveWatch();
  const now = useTick(1_000);
  const [cards, setCards] = useState<Record<string, CardState>>({});

  useEffect(() => {
    setCards((prev) => {
      const next: Record<string, CardState> = { ...prev };
      for (const e of active) {
        const existing = next[e.id];
        if (!existing) {
          next[e.id] = { ...e, flashKey: 0 };
        } else if (existing.status !== "printed") {
          next[e.id] = {
            ...existing,
            ...e,
            flashKey: existing.flashKey,
          };
        }
      }
      return next;
    });
  }, [active]);

  const handlePrint = useCallback((frame: EconPrintFrame) => {
    setCards((prev) => {
      const target = Object.values(prev).find(
        (c) =>
          c.eventName.toLowerCase() === frame.eventName.toLowerCase() &&
          c.status !== "printed",
      );
      if (!target) return prev;
      return {
        ...prev,
        [target.id]: {
          ...target,
          status: "printed",
          actual: frame.actual,
          forecast: frame.forecast ?? target.forecast,
          previous: frame.previous ?? target.previous,
          beatMiss: frame.beatMiss,
          surprisePercent: frame.surprisePercent ?? null,
          printedAt: frame.printedAt,
          flashKey: target.flashKey + 1,
        },
      };
    });
  }, []);

  useEconPrintStream(handlePrint);

  // [claude-code 2026-04-26] Dev-mode mock countdown — DeveloperTab dispatches
  // `fintheon:econ-mock-countdown` with optional { durationMs, eventName,
  // country, category, forecast, previous, actual }. Defaults to 60s.
  useEffect(() => {
    function onMock(ev: Event) {
      const detail = (ev as CustomEvent).detail ?? {};
      const durationMs =
        typeof detail.durationMs === "number" ? detail.durationMs : 60_000;
      const id = `mock-${Date.now()}`;
      const scheduledAt = new Date(Date.now() + durationMs).toISOString();
      const mockCard: CardState = {
        id,
        eventName: detail.eventName ?? "MOCK · Test Print (1m)",
        country: detail.country ?? "US",
        category: detail.category ?? "Mock",
        scheduledAt,
        forecast: detail.forecast ?? 0.5,
        previous: detail.previous ?? 0.4,
        actual: null,
        status: "upcoming",
        flashKey: 0,
      };
      setCards((prev) => ({ ...prev, [id]: mockCard }));

      // Fire a synthetic print after the countdown so the printed-state
      // transition is exercised end-to-end, mirroring real SSE arrival.
      const actual = detail.actual ?? 0.7;
      const forecast = mockCard.forecast ?? 0.5;
      const beatMiss: "beat" | "miss" | "inline" =
        actual > forecast ? "beat" : actual < forecast ? "miss" : "inline";
      const surprisePercent =
        forecast !== 0 ? ((actual - forecast) / forecast) * 100 : null;
      const printAt = durationMs + 250;
      const timer = window.setTimeout(() => {
        handlePrint({
          eventName: mockCard.eventName,
          actual,
          forecast,
          previous: mockCard.previous,
          surprisePercent,
          beatMiss,
          printedAt: new Date().toISOString(),
        });
      }, printAt);
      return () => window.clearTimeout(timer);
    }
    window.addEventListener(
      "fintheon:econ-mock-countdown",
      onMock as EventListener,
    );
    return () =>
      window.removeEventListener(
        "fintheon:econ-mock-countdown",
        onMock as EventListener,
      );
  }, [handlePrint]);

  const visible = useMemo(() => {
    return Object.values(cards)
      .map((card) => {
        const scheduled = new Date(card.scheduledAt).getTime();
        const msUntil = scheduled - now;
        if (card.status === "printed") return { card, msUntil, drop: false };
        if (msUntil > VISIBLE_WINDOW_MS) return { card, msUntil, drop: true };
        if (now - scheduled > STALE_WINDOW_MS) {
          return {
            card: { ...card, status: "missed" as Status },
            msUntil,
            drop: true,
          };
        }
        return { card, msUntil, drop: false };
      })
      .filter((v) => {
        if (v.card.status === "printed" && v.card.printedAt) {
          return (
            now - new Date(v.card.printedAt).getTime() < POST_PRINT_HOLD_MS
          );
        }
        return !v.drop;
      })
      .sort((a, b) => a.msUntil - b.msUntil)
      .slice(0, MAX_STACK);
  }, [cards, now]);

  useEffect(() => {
    const drop = Object.values(cards).filter((card) => {
      if (card.status === "printed" && card.printedAt) {
        return (
          now - new Date(card.printedAt).getTime() > POST_PRINT_HOLD_MS + 500
        );
      }
      const scheduled = new Date(card.scheduledAt).getTime();
      return now - scheduled > STALE_WINDOW_MS + 500;
    });
    if (drop.length === 0) return;
    setCards((prev) => {
      const next = { ...prev };
      drop.forEach((c) => delete next[c.id]);
      return next;
    });
  }, [cards, now]);

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-14 right-3 z-[60] flex flex-col gap-2 pointer-events-none">
      {visible.map(({ card, msUntil }) => (
        <CountdownCard key={card.id} card={card} msUntil={msUntil} />
      ))}
    </div>
  );
}

interface CountdownCardProps {
  card: CardState;
  msUntil: number;
}

function CountdownCard({ card, msUntil }: CountdownCardProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setVisible(true), 16);
    return () => window.clearTimeout(id);
  }, []);

  const isPrinted = card.status === "printed";
  const beatColor =
    card.beatMiss === "beat"
      ? "var(--fintheon-accent)"
      : card.beatMiss === "miss"
        ? "#94a3b8"
        : "#f0ead6";

  return (
    <div
      key={card.flashKey}
      className="pointer-events-auto w-[260px] px-3.5 py-3 text-[#f0ead6]"
      style={{
        backgroundColor: "#050402",
        border: "1px solid var(--fintheon-accent)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition:
          "opacity 400ms ease, transform 400ms ease, border-color 600ms ease",
        animation: isPrinted
          ? "econ-flash 300ms ease-out"
          : "econ-border-pulse 600ms ease-out",
      }}
    >
      <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-[#f0ead6]/60 mb-1.5">
        <span>
          {card.country ?? "—"} · {card.category ?? "Econ"}
        </span>
        <span>{isPrinted ? "PRINTED" : "T-MINUS"}</span>
      </div>

      <div className="text-[13px] font-medium leading-tight mb-2 text-[#f0ead6]">
        {card.eventName}
      </div>

      {isPrinted ? (
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[9px] uppercase tracking-[0.12em] text-[#f0ead6]/55">
              Actual
            </div>
            <div
              style={{ fontFamily: "var(--font-data)", color: beatColor }}
              className="text-[28px] leading-none"
            >
              {card.actual ?? "—"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-[0.12em] text-[#f0ead6]/55">
              Forecast
            </div>
            <div
              style={{ fontFamily: "var(--font-data)" }}
              className="text-[14px] leading-none text-[#f0ead6]/70"
            >
              {card.forecast ?? "—"}
            </div>
            <div
              className="mt-1 inline-block px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em]"
              style={{
                border: `1px solid ${beatColor}`,
                color: beatColor,
              }}
            >
              {card.beatMiss ?? "—"}
              {card.surprisePercent != null
                ? ` ${card.surprisePercent > 0 ? "+" : ""}${card.surprisePercent.toFixed(1)}%`
                : ""}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{ fontFamily: "var(--font-data)" }}
          className="text-[32px] leading-none text-[var(--fintheon-accent)] tabular-nums"
        >
          {formatCountdown(msUntil)}
        </div>
      )}

      <style>{`
        @keyframes econ-border-pulse {
          0% { border-color: var(--fintheon-accent); }
          100% { border-color: color-mix(in srgb, var(--fintheon-accent) 40%, transparent); }
        }
        @keyframes econ-flash {
          0% { background-color: color-mix(in srgb, var(--fintheon-accent) 18%, #050402); }
          100% { background-color: #050402; }
        }
      `}</style>
    </div>
  );
}
