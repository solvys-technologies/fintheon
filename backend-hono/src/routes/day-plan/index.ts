// [claude-code 2026-05-15] S66-T1: Added GET /multi-week route for multi-week desk plan cycling.
// [claude-code 2026-04-26] S45-T1: Day-plan route registration. /today and
// /week are public reads; /streak, /drift-status, /feedback require auth.
// [claude-code 2026-05-13] T4: Added POST /cao-evening-review route.

import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth.js";
import {
  handleGetToday,
  handleGetWeek,
  handleGetMultiWeek,
  handleGetStreak,
  handleGetGradedStreak,
  handleGetDriftStatus,
  handlePostFeedback,
  handleGetFeedback,
  handlePostCaoEveningReview,
} from "./handlers.js";

export function createDayPlanRoutes(): Hono {
  const router = new Hono();

  router.get("/today", handleGetToday);
  router.get("/week", handleGetWeek);
  router.get("/multi-week", handleGetMultiWeek);

  router.get("/streak", requireAuth, handleGetStreak);
  router.get("/streak/graded", requireAuth, handleGetGradedStreak);
  router.get("/drift-status", requireAuth, handleGetDriftStatus);
  router.get("/feedback", requireAuth, handleGetFeedback);
  router.post("/feedback", requireAuth, handlePostFeedback);

  // CAO evening review — Harper proposes window updates
  router.post("/cao-evening-review", handlePostCaoEveningReview);

  return router;
}
