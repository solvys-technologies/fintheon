// [claude-code 2026-04-24] Stub for /api/consul-control. The frontend hook
// useConsulControlStatus polls /status every 2s; without this route the dev
// console floods with 404s (231+ in a single session, per user report). The
// real "is Harper holding the wheel?" signal isn't wired yet — this route
// returns active=false and a hint so the frontend can stop polling on the
// "feature unavailable" branch and renders nothing.
import { Hono } from "hono";

export function createConsulControlRoutes(): Hono {
  const app = new Hono();

  app.get("/status", (c) => {
    return c.json({
      active: false,
      reason: "consul_control_not_wired",
    });
  });

  return app;
}
