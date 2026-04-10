// [claude-code 2026-03-30] Claude Peers Sprint 1 — Supabase auth utility routes
import { Hono } from "hono";
import type { Context } from "hono";
import { createClient } from "@supabase/supabase-js";
import {
  getUserById,
  hasAdminUsers,
  upsertUserRole,
} from "../../services/peers/peer-registry.js";
import { verifySupabaseToken } from "../../services/supabase-auth.js";

type AuthCtx = {
  userId: string;
  email: string;
};

function getAuthClient() {
  const url = process.env.SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function readBearerToken(c: Context): string | null {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

async function readAuthContext(c: Context): Promise<AuthCtx | null> {
  const token = readBearerToken(c);
  if (!token) return null;
  const payload = await verifySupabaseToken(token);
  return { userId: payload.sub, email: payload.email };
}

export function createAuthRoutes(): Hono {
  const router = new Hono();

  // Middleware: decode JWT when present and attach to context.
  router.use("*", async (c, next) => {
    try {
      await readAuthContext(c);
    } catch {
      // Keep routes public; handlers enforce auth where required.
    }
    await next();
  });

  router.post("/login", async (c) => {
    const client = getAuthClient();
    if (!client) {
      return c.json(
        {
          error:
            "Supabase auth is not configured (SUPABASE_URL + key required)",
        },
        503,
      );
    }

    const body = await c.req
      .json<{ email?: string; password?: string; magicLink?: boolean }>()
      .catch(() => null);
    if (!body?.email) return c.json({ error: "email is required" }, 400);

    if (body.magicLink) {
      const redirectTo = process.env.SUPABASE_MAGIC_LINK_REDIRECT;
      const { error } = await client.auth.signInWithOtp({
        email: body.email,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      });
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ ok: true, mode: "magic-link" });
    }

    if (!body.password) {
      return c.json(
        { error: "password is required when magicLink=false" },
        400,
      );
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    if (error) return c.json({ error: error.message }, 401);

    return c.json({
      session: data.session,
      user: data.user,
    });
  });

  router.post("/logout", async (c) => {
    // Session is client-side JWT; backend is stateless.
    return c.json({ ok: true });
  });

  router.get("/me", async (c) => {
    const auth = await readAuthContext(c).catch(() => null);
    if (!auth) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const profile = await getUserById(auth.userId);
    return c.json({
      user: {
        id: auth.userId,
        email: auth.email,
        displayName:
          profile?.displayName ?? auth.email.split("@")[0] ?? "Peer User",
        role: profile?.role ?? "peer",
        avatarUrl: profile?.avatarUrl ?? null,
        settings: profile?.settings ?? {},
      },
    });
  });

  router.post("/admin/add", async (c) => {
    const auth = await readAuthContext(c).catch(() => null);
    if (!auth) return c.json({ error: "Authentication required" }, 401);

    const requester = await getUserById(auth.userId);
    const adminExists = await hasAdminUsers();
    const bootstrapAllowed =
      process.env.NODE_ENV !== "production" && !adminExists;

    if (requester?.role !== "admin" && !bootstrapAllowed) {
      return c.json({ error: "Admin privileges required" }, 403);
    }

    const body = await c.req
      .json<{
        userId?: string;
        displayName?: string;
        avatarUrl?: string | null;
        settings?: Record<string, unknown>;
      }>()
      .catch(() => null);

    const targetUserId = body?.userId === "self" ? auth.userId : body?.userId;
    if (!targetUserId) return c.json({ error: "userId is required" }, 400);

    const user = await upsertUserRole(targetUserId, "admin", {
      displayName: body?.displayName,
      avatarUrl: body?.avatarUrl,
      settings: body?.settings,
    });

    return c.json({
      user,
      bootstrap: bootstrapAllowed && requester?.role !== "admin",
    });
  });

  return router;
}
