import { createHash } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { getSupabaseClient } from "../../config/supabase.js";

const waitlistSchema = z.object({
  email: z.string().email().max(320),
  source: z.string().min(1).max(80).optional(),
  pageUrl: z.string().url().max(1000).optional().nullable(),
  referrer: z.string().url().max(1000).optional().nullable(),
});

function hashIp(value: string | undefined) {
  if (!value) return null;
  const salt = process.env.WAITLIST_IP_HASH_SALT || "fintheon-marketing";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

function readClientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    forwarded ||
    undefined
  );
}

export function createMarketingRoutes(): Hono {
  const router = new Hono();

  router.post("/waitlist", async (c) => {
    let payload: unknown;
    try {
      payload = await c.req.json();
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }

    const parsed = waitlistSchema.safeParse(payload);
    if (!parsed.success) {
      return c.json({ error: "invalid_waitlist_request" }, 400);
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return c.json({ error: "waitlist_storage_unavailable" }, 503);
    }

    const email = parsed.data.email.trim();
    const emailNormalized = email.toLowerCase();
    const { error } = await supabase.from("marketing_waitlist").upsert(
      {
        email,
        email_normalized: emailNormalized,
        source: parsed.data.source ?? "fintheon-landing",
        page_url: parsed.data.pageUrl ?? null,
        referrer: parsed.data.referrer ?? null,
        user_agent: c.req.header("user-agent") ?? null,
        ip_hash: hashIp(readClientIp(c.req.raw.headers)),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email_normalized" },
    );

    if (error) {
      return c.json({ error: "waitlist_insert_failed" }, 500);
    }

    return c.json({ ok: true }, 201);
  });

  return router;
}
