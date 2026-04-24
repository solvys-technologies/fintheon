// [claude-code 2026-04-23] S32-T7: GET /api/calendar/next-event — next high-impact
// econ event within N seconds, for the heading-toolbar countdown pill. Reads the
// existing economic_events store via readEconEvents; no new polling.

import { Hono } from "hono";
import { readEconEvents } from "../../services/supabase-service.js";

interface NextEventPayload {
  name: string;
  time: string;
  impact: "low" | "medium" | "high";
  brief: string;
  secondsUntil: number;
}

function parseEventDate(date?: string, time?: string): Date | null {
  if (!date) return null;
  const hhmm = time && /^\d{1,2}:\d{2}/.test(time) ? time.slice(0, 5) : "00:00";
  const iso = `${date}T${hhmm}:00`;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatBrief(
  name: string,
  impact: "low" | "medium" | "high" | undefined,
  detail?: string,
): string {
  if (detail && detail.length > 0 && detail.length < 160) return detail;
  const impactLabel =
    impact === "high" ? "High-impact" : impact === "medium" ? "Mid-impact" : "";
  return impactLabel ? `${impactLabel} — ${name}` : name;
}

export function createCalendarRoutes(): Hono {
  const router = new Hono();

  router.get("/next-event", async (c) => {
    const withinParam = c.req.query("within");
    const withinSec = Math.max(
      60,
      Math.min(Number(withinParam ?? "300") || 300, 3600),
    );

    try {
      const now = new Date();
      const from = now.toISOString().slice(0, 10);
      const toStamp = new Date(now.getTime() + withinSec * 1000);
      const to = toStamp.toISOString().slice(0, 10);

      const events = await readEconEvents({ from, to });
      if (events.length === 0) return c.json({ event: null });

      let best: NextEventPayload | null = null;

      for (const evt of events) {
        if (evt.impact !== "high" && evt.impact !== "medium") continue;
        const when = parseEventDate(evt.date, evt.time);
        if (!when) continue;
        const secondsUntil = Math.round(
          (when.getTime() - now.getTime()) / 1000,
        );
        if (secondsUntil < 0 || secondsUntil > withinSec) continue;

        if (!best || secondsUntil < best.secondsUntil) {
          best = {
            name: evt.name,
            time: when.toISOString(),
            impact: evt.impact ?? "medium",
            brief: formatBrief(evt.name, evt.impact, evt.detail),
            secondsUntil,
          };
        }
      }

      return c.json({ event: best });
    } catch (err) {
      console.error("[calendar/next-event] error:", err);
      return c.json({ event: null }, 200);
    }
  });

  return router;
}
