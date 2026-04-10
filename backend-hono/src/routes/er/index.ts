import { Hono } from "hono";
import {
  handleCheckOvertrading,
  handleGetSessions,
  handleSaveSession,
  handleSaveSnapshot,
} from "./handlers.js";

export function createERRoutes(): Hono {
  const router = new Hono();

  router.get("/sessions", handleGetSessions);
  router.post("/sessions", handleSaveSession);
  router.post("/snapshots", handleSaveSnapshot);
  router.post("/check-overtrading", handleCheckOvertrading);

  return router;
}
