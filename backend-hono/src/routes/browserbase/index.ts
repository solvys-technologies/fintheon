// [claude-code 2026-04-25] S40-P9: /api/browserbase/* router.

import { Hono } from "hono";
import {
  handleActiveSession,
  handleCloseSession,
  handleCreateSession,
  handleExtract,
  handleNavigate,
  handleStream,
} from "./handlers.js";

export function createBrowserbaseRoutes(): Hono {
  const router = new Hono();
  router.post("/sessions", handleCreateSession);
  router.delete("/sessions/active", handleCloseSession);
  router.get("/sessions/active", handleActiveSession);
  router.post("/sessions/active/navigate", handleNavigate);
  router.post("/sessions/active/extract", handleExtract);
  router.get("/stream", handleStream);
  return router;
}
