// [claude-code 2026-04-26] S45-T1: Day-plan route registration. /today and
// /week are public reads; /streak, /drift-status, /feedback require auth.

import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth.js";
import {
  handleGetToday,
  handleGetWeek,
  handleGetStreak,
  handleGetDriftStatus,
  handlePostFeedback,
  handleGetFeedback,
} from "./handlers.js";

export function createDayPlanRoutes(): Hono {
  const router = new Hono();

  router.get("/today", handleGetToday);
  router.get("/week", handleGetWeek);

  router.get("/streak", requireAuth, handleGetStreak);
  router.get("/drift-status", requireAuth, handleGetDriftStatus);
  router.get("/feedback", requireAuth, handleGetFeedback);
  router.post("/feedback", requireAuth, handlePostFeedback);

  return router;
}
