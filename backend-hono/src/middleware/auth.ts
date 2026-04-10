// [claude-code 2026-04-05] Supabase JWT auth — optional auth for public access, requireAuth for protected routes
// Service role key accepted as bearer token for internal bootstrap (peer-bootstrap, cron, etc.)
import type { Context, Next } from "hono";
import { verifySupabaseToken } from "../services/supabase-auth.js";

const BYPASS_AUTH = process.env.BYPASS_AUTH === "true";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const ANON_USER = { userId: "anonymous", email: "anonymous" } as const;
const LOCAL_USER = { userId: "local-user", email: "user@local" } as const;

function setAuthContext(c: Context, user: { userId: string; email: string }) {
  c.set("auth", user);
  c.set("userId", user.userId);
  c.set("supabaseUid", user.userId);
  c.set("email", user.email);
}

/**
 * Auth Middleware — optional Supabase JWT verification
 * - BYPASS_AUTH=true: sets local-user (dev/electron mode)
 * - Bearer token present: validates with Supabase, rejects if invalid
 * - No token: sets anonymous context and continues (public access)
 */
export const authMiddleware = async (c: Context, next: Next) => {
  if (BYPASS_AUTH) {
    setAuthContext(c, LOCAL_USER);
    return await next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    // No token — allow anonymous access
    setAuthContext(c, ANON_USER);
    return await next();
  }

  const token = authHeader.slice(7);

  // Service role key = trusted internal caller (peer-bootstrap, cron jobs, etc.)
  if (SERVICE_ROLE_KEY && token === SERVICE_ROLE_KEY) {
    setAuthContext(c, LOCAL_USER);
    return await next();
  }

  try {
    const payload = await verifySupabaseToken(token);
    setAuthContext(c, { userId: payload.sub, email: payload.email });
    return await next();
  } catch (error) {
    console.error("[auth] Token verification failed:", error);
    return c.json({ error: "Invalid or expired token" }, 401);
  }
};

/**
 * Require Auth — rejects anonymous users (must be stacked after authMiddleware)
 * Use on endpoints that must have a verified identity (trading, account, settings).
 */
export const requireAuth = async (c: Context, next: Next) => {
  const userId = c.get("userId");
  if (!userId || userId === "anonymous") {
    return c.json(
      {
        error: "Authentication required",
        hint: "Provide a Bearer token in the Authorization header",
      },
      401,
    );
  }
  return await next();
};
