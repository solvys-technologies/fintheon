// [claude-code 2026-03-05] Economic Calendar API routes — calendar events, prints, write actuals.
// [claude-code 2026-03-16] Added econ-poller-status endpoint for smart polling visibility.

import { Hono } from 'hono';
import {
  fetchEconCalendar,
  fetchEconPrints,
  writeEconPrint,
  updateEventActual,
} from '../../services/econ-calendar-service.js';
import { getUserSettings } from '../../services/settings-store.js';

export function createEconCalendarRoutes(): Hono {
  const app = new Hono();

  // GET /api/notion/econ-calendar?from=2026-03-01&to=2026-03-07
  app.get('/econ-calendar', async (c) => {
    try {
      const from = c.req.query('from');
      const to = c.req.query('to');
      const events = await fetchEconCalendar({ from, to });
      return c.json({ events, count: events.length });
    } catch (err) {
      console.error('[EconCalendar] /econ-calendar error:', err);
      return c.json({ events: [], count: 0 }, 500);
    }
  });

  // GET /api/notion/econ-prints?event=CPI
  app.get('/econ-prints', async (c) => {
    try {
      const eventName = c.req.query('event');
      const prints = await fetchEconPrints(eventName || undefined);
      return c.json({ prints, count: prints.length });
    } catch (err) {
      console.error('[EconCalendar] /econ-prints error:', err);
      return c.json({ prints: [], count: 0 }, 500);
    }
  });

  // POST /api/notion/econ-print — write an actual print result
  app.post('/econ-print', async (c) => {
    try {
      const body = await c.req.json<{
        eventName: string;
        date: string;
        actual: number;
        forecast?: number;
        previous?: number;
      }>();
      if (!body.eventName || !body.date || body.actual == null) {
        return c.json({ error: 'eventName, date, actual required' }, 400);
      }
      const result = await writeEconPrint(body);
      if (!result) return c.json({ error: 'Failed to write print' }, 500);
      return c.json({ success: true, ...result });
    } catch (err) {
      console.error('[EconCalendar] /econ-print POST error:', err);
      return c.json({ error: 'Internal error' }, 500);
    }
  });

  // PATCH /api/notion/econ-event/:id/actual — update actual on existing event
  app.patch('/econ-event/:id/actual', async (c) => {
    try {
      const id = c.req.param('id');
      const { actual } = await c.req.json<{ actual: string }>();
      if (!actual) return c.json({ error: 'actual required' }, 400);
      const ok = await updateEventActual(id, actual);
      return ok ? c.json({ success: true }) : c.json({ error: 'Update failed' }, 500);
    } catch (err) {
      console.error('[EconCalendar] PATCH econ-event error:', err);
      return c.json({ error: 'Internal error' }, 500);
    }
  });

  // GET /api/notion/econ-poller-status — smart polling window status
  app.get('/econ-poller-status', async (c) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const events = await fetchEconCalendar({ from: today, to: today });
      const highImportance = events.filter((e: { importance?: number }) => (e.importance ?? 1) >= 2);

      const now = Date.now();
      const PRE = 5;   // T-5min
      const POST = 15; // T+15min

      const upcoming = highImportance
        .map((e: { name: string; date?: string; time?: string }) => {
          if (!e.date || !e.time) return null;
          const eventMs = new Date(`${e.date}T${e.time}`).getTime();
          const diffMin = (now - eventMs) / 60_000;
          return { name: e.name, time: e.time, msUntil: eventMs - now, inWindow: diffMin >= -PRE && diffMin <= POST };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null)
        .sort((a, b) => a.msUntil - b.msUntil);

      const activeInWindow = upcoming.filter(e => e.inWindow);
      const nextEvent = upcoming.find(e => e.msUntil > -POST * 60_000);

      let autoRefresh = true;
      try {
        const settings = await getUserSettings('default');
        if (settings.autoRefresh !== undefined) autoRefresh = settings.autoRefresh as boolean;
      } catch { /* default true */ }

      return c.json({
        active: activeInWindow.length > 0,
        autoRefresh,
        nextEvent: nextEvent ? { name: nextEvent.name, time: nextEvent.time, msUntil: nextEvent.msUntil } : null,
        todayEventCount: highImportance.length,
        eventsInWindow: activeInWindow.length,
      });
    } catch (err) {
      return c.json({ active: false, autoRefresh: true, nextEvent: null, todayEventCount: 0, eventsInWindow: 0 }, 500);
    }
  });

  return app;
}
