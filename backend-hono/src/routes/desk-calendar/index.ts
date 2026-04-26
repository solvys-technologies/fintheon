// [claude-code 2026-04-26] S46: TV Calendar Final Integration. Public-read queue
// for Desk Theme agents; ingest is text/calendar POST from Electron.

import { Hono } from "hono";
import {
  handleIngestIcs,
  handleGetQueue,
  handleGetStatus,
} from "./handlers.js";

export function createDeskCalendarRoutes(): Hono {
  const router = new Hono();

  router.post("/ingest-ics", handleIngestIcs);
  router.get("/queue", handleGetQueue);
  router.get("/status", handleGetStatus);

  return router;
}
