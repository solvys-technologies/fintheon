import { Hono } from "hono";
import type { Context } from "hono";
import {
  readDeskAgentStyle,
  saveDeskAgentStyle,
} from "../../services/coliseum/agent-style.js";
import { resolveColiseumDeskId } from "../../services/coliseum/desks.js";
import {
  createDraftForecast,
  listForecasts,
  publishForecast,
  readForecast,
} from "../../services/coliseum/forecasts.js";
import {
  readDeskPermission,
  requireCanDraft,
  requireCanPublish,
} from "../../services/coliseum/permissions.js";
import {
  readDeskProfile,
  saveDeskProfile,
} from "../../services/coliseum/profiles.js";
import { runForecastMonitor } from "../../services/coliseum/thesis-monitor.js";
import { isAuthedActor } from "../../services/coliseum/db.js";
import {
  deskAgentStyleSchema,
  deskProfileSchema,
  forecastSchema,
} from "../../services/coliseum/validation.js";

export function createColiseumRoutes(): Hono {
  const app = new Hono();

  app.get("/desks/:deskId/profile", async (c) =>
    handle(c, async () => {
      const profile = await readDeskProfile(c.req.param("deskId"), actorId(c));
      return c.json({ profile });
    }),
  );

  app.put("/desks/:deskId/profile", async (c) =>
    handle(c, async () => {
      const userId = requireActor(c);
      const deskId = await resolveColiseumDeskId(c.req.param("deskId"), userId);
      await requireCanPublish(deskId, userId);
      const parsed = deskProfileSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
      const profile = await saveDeskProfile({
        deskId,
        actorId: userId,
        profile: parsed.data,
      });
      return c.json({ profile });
    }),
  );

  app.get("/desks/:deskId/agent-style", async (c) =>
    handle(c, async () => {
      const style = await readDeskAgentStyle(c.req.param("deskId"), actorId(c));
      return c.json({ style });
    }),
  );

  app.put("/desks/:deskId/agent-style", async (c) =>
    handle(c, async () => {
      const userId = requireActor(c);
      const deskId = await resolveColiseumDeskId(c.req.param("deskId"), userId);
      await requireCanPublish(deskId, userId);
      const parsed = deskAgentStyleSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
      const style = await saveDeskAgentStyle({
        deskId,
        actorId: userId,
        style: parsed.data,
      });
      return c.json({ style });
    }),
  );

  app.get("/desks/:deskId/permissions", async (c) =>
    handle(c, async () => {
      const deskId = await resolveColiseumDeskId(
        c.req.param("deskId"),
        actorId(c),
      );
      const permission = await readDeskPermission(deskId, actorId(c));
      return c.json({ permission });
    }),
  );

  app.get("/forecasts", async (c) =>
    handle(c, async () => {
      const forecasts = await listForecasts(
        c.req.query("deskId") ?? "default",
        actorId(c),
      );
      return c.json({ forecasts });
    }),
  );

  app.post("/forecasts", async (c) =>
    handle(c, async () => {
      const userId = requireActor(c);
      const parsed = forecastSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
      const deskId = await resolveColiseumDeskId(parsed.data.deskId, userId);
      await requireCanDraft(deskId, userId);
      const forecast = await createDraftForecast({
        actorId: userId,
        forecast: { ...parsed.data, deskId },
      });
      return c.json({ forecast });
    }),
  );

  app.get("/forecasts/:id", async (c) =>
    handle(c, async () => {
      const forecast = await readForecast(c.req.param("id"));
      return c.json({ forecast });
    }),
  );

  app.post("/forecasts/:id/publish", async (c) =>
    handle(c, async () => {
      const userId = requireActor(c);
      const current = await readForecast(c.req.param("id"));
      await requireCanPublish(current.deskId, userId);
      const forecast = await publishForecast({
        id: current.id,
        actorId: userId,
      });
      return c.json({ forecast });
    }),
  );

  app.post("/forecasts/:id/monitor", async (c) =>
    handle(c, async () => {
      const userId = requireActor(c);
      const current = await readForecast(c.req.param("id"));
      await requireCanPublish(current.deskId, userId);
      const result = await runForecastMonitor(current.id);
      return c.json(result);
    }),
  );

  return app;
}

function actorId(c: Context): string | null {
  const userId = c.get("userId") as string | undefined;
  return isAuthedActor(userId) ? userId : null;
}

function requireActor(c: Context): string {
  const userId = actorId(c);
  if (!userId) throw routeError("Authentication required", 401);
  return userId;
}

async function handle(
  c: Context,
  run: () => Promise<Response>,
): Promise<Response> {
  try {
    return await run();
  } catch (err) {
    if (isRouteError(err)) return c.json({ error: err.message }, err.status);
    const message = err instanceof Error ? err.message : String(err);
    const status =
      message.includes("permission") || message.includes("membership")
        ? 403
        : 500;
    return c.json({ error: message }, status);
  }
}

interface RouteError extends Error {
  status: 401 | 403 | 404;
}

function routeError(message: string, status: RouteError["status"]): RouteError {
  return Object.assign(new Error(message), { status });
}

function isRouteError(err: unknown): err is RouteError {
  return err instanceof Error && "status" in err;
}
