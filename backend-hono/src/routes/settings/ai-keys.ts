// [claude-code 2026-05-03] S58-T1: DeepSeek BYOK settings endpoints.
// [claude-code 2026-05-05] Expand to provider-scoped key reads/writes
// for deepseek + opencode-go so personal provider selection can hydrate keys.
import { Hono } from "hono";
import { z } from "zod";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "../../config/supabase.js";
import {
  decryptApiKey,
  encryptApiKey,
  maskApiKey,
} from "../../services/ai/api-key-crypto.js";
import {
  deleteLocalProviderKey,
  getLocalProviderKey,
  upsertLocalProviderKey,
} from "../../services/hermes/local-user-config.js";

const ProviderSchema = z.enum(["deepseek", "opencode-go"]);
const UpsertKeySchema = z.object({
  provider: ProviderSchema.default("deepseek"),
  apiKey: z.string().trim().min(10).max(4096),
  keyLabel: z.string().trim().max(80).optional(),
});

function defaultKeyLabel(provider: z.infer<typeof ProviderSchema>): string {
  if (provider === "opencode-go") return "OpenCode Go API key";
  return "DeepSeek API key";
}

function resolveOpenCodeBaseUrl(): string {
  const raw =
    process.env.OPENCODE_GO_API_URL ||
    process.env.HERMES_API_URL ||
    "http://localhost:8081/v1";
  return raw.replace(/\/$/, "");
}

function authedUserId(c: { get: (key: string) => unknown }): string | null {
  const userId = c.get("userId");
  if (typeof userId !== "string") return null;
  if (userId === "anonymous") return null;
  return userId;
}

function dbUserId(userId: string): string {
  // In local dev (BYPASS_AUTH), map "local-user" to a stable dev UUID
  // so API keys can be tested. RLS bypassed via service_role.
  if (userId === "local-user") return "00000000-0000-0000-0000-000000000001";
  return userId;
}

export function createAiKeysRoutes(): Hono {
  const router = new Hono();

  router.get("/", async (c) => {
    const userId = authedUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    const uid = dbUserId(userId);

    const providerQuery = c.req.query("provider");
    if (providerQuery) {
      const parsedProvider = ProviderSchema.safeParse(providerQuery);
      if (!parsedProvider.success) {
        return c.json({ error: "Unsupported provider" }, 400);
      }
      const provider = parsedProvider.data;
      // Local-only/bypass path
      if (userId === "local-user" || !isSupabaseConfigured()) {
        const localKey = getLocalProviderKey(userId, provider);
        return c.json({
          provider,
          hasKey: Boolean(localKey),
          maskedKey: localKey ? maskApiKey(localKey) : null,
          keyLabel: localKey ? defaultKeyLabel(provider) : null,
          apiKey: localKey,
          ...(provider === "opencode-go"
            ? { baseUrl: resolveOpenCodeBaseUrl() }
            : {}),
        });
      }

      const sb = getSupabaseClient()!;
      const { data, error } = await sb
        .from("user_api_keys")
        .select("provider, encrypted_key, key_label, created_at, updated_at")
        .eq("user_id", uid)
        .eq("provider", provider)
        .maybeSingle();
      if (error) return c.json({ error: error.message }, 500);
      if (!data?.encrypted_key) {
        const localKey = getLocalProviderKey(userId, provider);
        return c.json({
          provider,
          hasKey: Boolean(localKey),
          maskedKey: localKey ? maskApiKey(localKey) : null,
          keyLabel: localKey ? defaultKeyLabel(provider) : null,
          apiKey: localKey,
          ...(provider === "opencode-go"
            ? { baseUrl: resolveOpenCodeBaseUrl() }
            : {}),
        });
      }
      try {
        const apiKey = decryptApiKey(String(data.encrypted_key));
        return c.json({
          provider,
          hasKey: true,
          maskedKey: maskApiKey(apiKey),
          keyLabel: data.key_label ?? defaultKeyLabel(provider),
          apiKey,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          ...(provider === "opencode-go"
            ? { baseUrl: resolveOpenCodeBaseUrl() }
            : {}),
        });
      } catch {
        return c.json({
          provider,
          hasKey: false,
          maskedKey: "unreadable",
          keyLabel: data.key_label ?? defaultKeyLabel(provider),
          apiKey: null,
          ...(provider === "opencode-go"
            ? { baseUrl: resolveOpenCodeBaseUrl() }
            : {}),
        });
      }
    }

    if (!isSupabaseConfigured() || userId === "local-user") {
      const keys = (["deepseek", "opencode-go"] as const)
        .map((provider) => {
          const local = getLocalProviderKey(userId, provider);
          if (!local) return null;
          return {
            provider,
            keyLabel: defaultKeyLabel(provider),
            masked: maskApiKey(local),
            createdAt: null,
            updatedAt: null,
          };
        })
        .filter(Boolean);
      return c.json({ keys, keyCount: keys.length });
    }

    const sb = getSupabaseClient()!;
    const { data, error } = await sb
      .from("user_api_keys")
      .select("provider, encrypted_key, key_label, created_at, updated_at")
      .eq("user_id", uid)
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

    const parsed = UpsertKeySchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success)
      return c.json({ error: "Invalid API key payload" }, 400);

    // Always write user key into Hermes-local config so local agentic tasks
    // can resolve credentials even when backend DB access is unavailable.
    upsertLocalProviderKey(
      userId,
      parsed.data.provider,
      parsed.data.apiKey,
      parsed.data.provider === "opencode-go"
        ? resolveOpenCodeBaseUrl()
        : undefined,
    );

    if (!isSupabaseConfigured() || userId === "local-user") {
      return c.json({
        success: true,
        provider: parsed.data.provider,
        updatedAt: new Date().toISOString(),
        backendSaved: false,
        localHermesSaved: true,
      });
    }

    const uid = dbUserId(userId);
    const now = new Date().toISOString();
    const sb = getSupabaseClient()!;
    let encryptedKey: string;
    try {
      encryptedKey = encryptApiKey(parsed.data.apiKey);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to encrypt API key",
        },
        500,
      );
    }
    const { error } = await sb.from("user_api_keys").upsert(
      {
        user_id: uid,
        provider: parsed.data.provider,
        encrypted_key: encryptedKey,
        key_label:
          parsed.data.keyLabel ?? defaultKeyLabel(parsed.data.provider),
        updated_at: now,
      },
      { onConflict: "user_id,provider" },
    );
    if (error) return c.json({ error: error.message }, 500);
    return c.json({
      success: true,
      provider: parsed.data.provider,
      updatedAt: now,
      backendSaved: true,
      localHermesSaved: true,
    });
  });

  router.delete("/", async (c) => {
    const userId = authedUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const providerQuery = c.req.query("provider") || "deepseek";
    const parsedProvider = ProviderSchema.safeParse(providerQuery);
    if (!parsedProvider.success) {
      return c.json({ error: "Unsupported provider" }, 400);
    }
    const provider = parsedProvider.data;
    deleteLocalProviderKey(userId, provider);

    if (!isSupabaseConfigured() || userId === "local-user") {
      return c.json({
        success: true,
        provider,
        backendSaved: false,
        localHermesSaved: true,
      });
    }

    const uid = dbUserId(userId);
    const { error } = await getSupabaseClient()!
      .from("user_api_keys")
      .delete()
      .eq("user_id", uid)
      .eq("provider", provider);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({
      success: true,
      provider,
      backendSaved: true,
      localHermesSaved: true,
    });
  });

  return router;
}
