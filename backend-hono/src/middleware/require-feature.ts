// [claude-code 2026-04-20] S21-T5: Feature-gate middleware.
// Usage: `app.use('/api/admin/psych-assist/*', requireAuth, requireFeature('psych_assist_fork.edit'))`.
// The check uses the per-user resolution path so we honour user_feature_overrides rows.

import type { Context, Next } from "hono";
import { getFlagForUser } from "../services/feature-flag-service.js";

export const requireFeature = (feature: string) => {
  return async (c: Context, next: Next) => {
    const userId = c.get("userId");
    if (!userId || userId === "anonymous") {
      return c.json({ error: "Authentication required" }, 401);
    }
    const allowed = await getFlagForUser(feature, userId);
    if (!allowed) {
      return c.json(
        { error: "Feature not enabled for this user", feature },
        403,
      );
    }
    return await next();
  };
};
