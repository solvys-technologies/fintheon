// [claude-code 2026-04-10] Sticky bulletin routes — user notes, event of week, antilag times
import { Hono } from "hono";
import type { Context } from "hono";
import {
  getUserBulletin,
  saveUserBulletin,
  addAntilagTime,
  getAntilagAggregates,
} from "../../services/sticky-bulletin-store.js";

function getUserId(c: Context): string | null {
  const userId = c.get("userId") as string | undefined;
  if (!userId || userId === "anon") return null;
  return userId;
}

export function createStickyBulletinRoutes(): Hono {
  const app = new Hono();

  // GET / — get user's sticky bulletin data
  app.get("/", async (c) => {
    const userId = getUserId(c);
    if (!userId) return c.json({ error: "Authentication required" }, 401);

    const data = await getUserBulletin(userId);
    return c.json({ data });
  });

  // PUT / — save user's notes and/or event of week
  app.put("/", async (c) => {
    const userId = getUserId(c);
    if (!userId) return c.json({ error: "Authentication required" }, 401);

    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: "Invalid payload" }, 400);

    await saveUserBulletin(userId, {
      tradingNotes: body.tradingNotes,
      eventOfWeek: body.eventOfWeek,
    });
    return c.json({ ok: true });
  });

  // POST /antilag — record an antilag time observation
  app.post("/antilag", async (c) => {
    const userId = getUserId(c);
    if (!userId) return c.json({ error: "Authentication required" }, 401);

    const body = await c.req.json().catch(() => null);
    if (!body?.time || body.dayOfWeek === undefined) {
      return c.json({ error: "time and dayOfWeek required" }, 400);
    }

    await addAntilagTime(userId, {
      time: body.time,
      dayOfWeek: body.dayOfWeek,
      instrument: body.instrument ?? "",
      notes: body.notes ?? "",
    });
    return c.json({ ok: true });
  });

  // GET /antilag/aggregates — aggregated antilag data across all users
  app.get("/antilag/aggregates", async (c) => {
    const aggregates = await getAntilagAggregates();
    return c.json({ aggregates });
  });

  return app;
}
