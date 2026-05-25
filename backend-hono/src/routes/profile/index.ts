// [claude-code 2026-03-24] User profile routes — CRUD + app state persistence
import { Hono } from "hono";
import type { Context } from "hono";
import {
  getOrCreateProfile,
  updateProfile,
  getAppState,
  upsertAppState,
} from "../../services/supabase-service.js";
import { normalizeSocialLinks } from "../../services/proxvoice/social-links.js";
import { getPublicVoiceProfile } from "../../services/proxvoice/token-service.js";

export function createProfileRoutes(): Hono {
  const router = new Hono();

  // GET /api/profile — Get current user's profile (create if not exists)
  router.get("/", async (c: Context) => {
    const supabaseUid = c.get("supabaseUid") as string;
    const email = c.get("email") as string | undefined;

    const profile = await getOrCreateProfile(supabaseUid, email);
    if (!profile) {
      return c.json({ error: "Failed to get or create profile" }, 500);
    }
    return c.json(profile);
  });

  // PUT /api/profile — Update profile fields
  router.put("/", async (c: Context) => {
    const supabaseUid = c.get("supabaseUid") as string;
    const body = await c.req.json<{
      email?: string;
      display_name?: string;
      avatar_url?: string;
      tier?: "free" | "fintheon" | "fintheon_plus" | "fintheon_pro";
      onboarding_complete?: boolean;
    }>();

    const profile = await updateProfile(supabaseUid, body);
    if (!profile) {
      return c.json({ error: "Failed to update profile" }, 500);
    }
    return c.json(profile);
  });

  // GET /api/profile/app-state — Get app_state JSONB
  router.get("/app-state", async (c: Context) => {
    const supabaseUid = c.get("supabaseUid") as string;

    const state = await getAppState(supabaseUid);
    if (state === null) {
      return c.json({ error: "Profile not found" }, 404);
    }
    return c.json(state);
  });

  // PUT /api/profile/app-state — Upsert app_state JSONB (merges into existing state)
  router.put("/app-state", async (c: Context) => {
    const supabaseUid = c.get("supabaseUid") as string;
    const body = await c.req.json<{ state?: Record<string, unknown> }>();
    const incoming = body.state ?? (body as Record<string, unknown>);

    // Ensure profile exists before upserting state
    const email = c.get("email") as string | undefined;
    await getOrCreateProfile(supabaseUid, email);

    // Merge incoming keys into existing app_state
    const existing = await getAppState(supabaseUid);
    const merged = { ...(existing ?? {}), ...incoming };

    const ok = await upsertAppState(supabaseUid, merged);
    if (!ok) {
      return c.json({ error: "Failed to update app state" }, 500);
    }
    return c.json({ ok: true });
  });

  router.get("/social-links", async (c: Context) => {
    const supabaseUid = c.get("supabaseUid") as string;
    const state = await getAppState(supabaseUid);
    if (state === null) return c.json({ error: "Profile not found" }, 404);
    const appState = state as { socialLinks?: unknown };
    return c.json({ socialLinks: normalizeSocialLinks(appState.socialLinks) });
  });

  router.put("/social-links", async (c: Context) => {
    const supabaseUid = c.get("supabaseUid") as string;
    const email = c.get("email") as string | undefined;
    await getOrCreateProfile(supabaseUid, email);
    const body = (await c.req
      .json<{ socialLinks?: unknown }>()
      .catch(() => ({}))) as { socialLinks?: unknown };
    const existing = (await getAppState(supabaseUid)) ?? {};
    const socialLinks = normalizeSocialLinks(body.socialLinks ?? body);
    const ok = await upsertAppState(supabaseUid, { ...existing, socialLinks });
    if (!ok) return c.json({ error: "Failed to update social links" }, 500);
    return c.json({ socialLinks });
  });

  router.get("/voice-profile", async (c: Context) => {
    const supabaseUid = c.get("supabaseUid") as string;
    const email = c.get("email") as string | undefined;
    const profile = await getPublicVoiceProfile({ userId: supabaseUid, email });
    return c.json({ profile });
  });

  router.put("/voice-profile", async (c: Context) => {
    const supabaseUid = c.get("supabaseUid") as string;
    const email = c.get("email") as string | undefined;
    await getOrCreateProfile(supabaseUid, email);
    const body = (await c.req.json().catch(() => ({}))) as {
      displayName?: unknown;
      avatarUrl?: unknown;
      bio?: unknown;
      position?: unknown;
      broker?: unknown;
      socialLinks?: unknown;
    };
    const displayName =
      typeof body.displayName === "string" ? body.displayName.trim().slice(0, 32) : undefined;
    const avatarUrl =
      typeof body.avatarUrl === "string" ? body.avatarUrl.trim().slice(0, 500_000) : undefined;
    if (displayName || avatarUrl !== undefined) {
      await updateProfile(supabaseUid, {
        ...(displayName ? { display_name: displayName } : {}),
        ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
      });
    }
    const existing = (await getAppState(supabaseUid)) ?? {};
    const nextState = {
      ...existing,
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      ...(typeof body.bio === "string" ? { bio: body.bio.trim().slice(0, 180) } : {}),
      ...(typeof body.position === "string"
        ? { position: body.position.trim().slice(0, 48) }
        : {}),
      ...(typeof body.broker === "string"
        ? { broker: body.broker.trim().slice(0, 48) }
        : {}),
      ...(body.socialLinks ? { socialLinks: normalizeSocialLinks(body.socialLinks) } : {}),
    };
    await upsertAppState(supabaseUid, nextState);
    const profile = await getPublicVoiceProfile({ userId: supabaseUid, email });
    return c.json({ profile });
  });

  return router;
}
