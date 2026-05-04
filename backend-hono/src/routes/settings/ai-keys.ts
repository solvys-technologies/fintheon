// [claude-code 2026-05-03] S58-T1: DeepSeek BYOK settings endpoints.
import { Hono } from "hono";
import { z } from "zod";
import { getSupabaseClient, isSupabaseConfigured } from "../../config/supabase.js";
import { decryptApiKey, encryptApiKey, maskApiKey } from "../../services/ai/api-key-crypto.js";

const ProviderSchema = z.literal("deepseek");
const UpsertKeySchema = z.object({
  provider: ProviderSchema.default("deepseek"),
  apiKey: z.string().trim().min(10).max(4096),
  keyLabel: z.string().trim().max(80).optional(),
});

function authedUserId(c: { get: (key: string) => unknown }): string | null {
  const userId = c.get("userId");
  return typeof userId === "string" && userId !== "anonymous" ? userId : null;
}

export function createAiKeysRoutes(): Hono {
  const router = new Hono();

  router.get("/", async (c) => {
    const userId = authedUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    if (!isSupabaseConfigured()) return c.json({ error: "DB not configured" }, 500);

    const sb = getSupabaseClient()!;
    const { data, error } = await sb
      .from("user_api_keys")
      .select("provider, encrypted_key, key_label, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) return c.json({ error: error.message }, 500);

    const keys = (data ?? []).map((row) => {
      let masked = "****";
      try {
        masked = maskApiKey(decryptApiKey(String(row.encrypted_key ?? "")));
      } catch {
        masked = "unreadable";
      }
      return {
        provider: row.provider,
        keyLabel: row.key_label,
        masked,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
    return c.json({ keys, keyCount: keys.length });
  });

  router.post("/", async (c) => {
    const userId = authedUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    if (!isSupabaseConfigured()) return c.json({ error: "DB not configured" }, 500);

    const parsed = UpsertKeySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Invalid API key payload" }, 400);

    const now = new Date().toISOString();
    const sb = getSupabaseClient()!;
    const { error } = await sb.from("user_api_keys").upsert(
      {
        user_id: userId,
        provider: parsed.data.provider,
        encrypted_key: encryptApiKey(parsed.data.apiKey),
        key_label: parsed.data.keyLabel ?? "DeepSeek API key",
        updated_at: now,
      },
      { onConflict: "user_id,provider" },
    );
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, provider: parsed.data.provider, updatedAt: now });
  });

  router.delete("/", async (c) => {
    const userId = authedUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    if (!isSupabaseConfigured()) return c.json({ error: "DB not configured" }, 500);

    const provider = c.req.query("provider") || "deepseek";
    if (provider !== "deepseek") return c.json({ error: "Unsupported provider" }, 400);
    const { error } = await getSupabaseClient()!
      .from("user_api_keys")
      .delete()
      .eq("user_id", userId)
      .eq("provider", provider);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, provider });
  });

  return router;
}
