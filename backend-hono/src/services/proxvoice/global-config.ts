import { sql } from "../../config/database.js";

interface ProxVoiceConfig {
  apiKey: string;
  apiSecret: string;
  url: string;
  source: "env" | "vault";
}

const defaultLiveKitUrl = "wss://fintheon-livekit.fly.dev";
const cacheTtlMs = 60_000;
let cachedConfig: { value: ProxVoiceConfig | null; expiresAt: number } | null =
  null;
let hasEnsuredTable = false;

export async function resolveProxVoiceConfig(): Promise<ProxVoiceConfig | null> {
  if (cachedConfig && cachedConfig.expiresAt > Date.now()) {
    return cachedConfig.value;
  }

  const envConfig = readEnvConfig();
  if (envConfig) {
    await persistEnvConfig(envConfig);
    return cache(envConfig);
  }

  return cache(await readVaultConfig());
}

export async function getProxVoiceStatus(): Promise<{
  configured: boolean;
  source: ProxVoiceConfig["source"] | null;
  url: string;
}> {
  const config = await resolveProxVoiceConfig();
  return {
    configured: Boolean(config),
    source: config?.source ?? null,
    url: config?.url ?? process.env.LIVEKIT_URL ?? defaultLiveKitUrl,
  };
}

function readEnvConfig(): ProxVoiceConfig | null {
  const apiKey = nonEmpty(process.env.LIVEKIT_API_KEY);
  const apiSecret = nonEmpty(process.env.LIVEKIT_API_SECRET);
  if (!apiKey || !apiSecret) return null;
  return {
    apiKey,
    apiSecret,
    url: nonEmpty(process.env.LIVEKIT_URL) ?? defaultLiveKitUrl,
    source: "env",
  };
}

async function readVaultConfig(): Promise<ProxVoiceConfig | null> {
  const values = await readServerSecrets([
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    "LIVEKIT_URL",
  ]);
  const apiKey = nonEmpty(values.LIVEKIT_API_KEY);
  const apiSecret = nonEmpty(values.LIVEKIT_API_SECRET);
  if (!apiKey || !apiSecret) return null;
  return {
    apiKey,
    apiSecret,
    url: nonEmpty(values.LIVEKIT_URL) ?? defaultLiveKitUrl,
    source: "vault",
  };
}

async function readServerSecrets(
  keys: string[],
): Promise<Record<string, string>> {
  if (!canTryGlobalVault()) return {};
  try {
    await ensureServerSecretsTable();
    const out: Record<string, string> = {};
    for (const key of keys) {
      const rows = (await sql`
        SELECT value
        FROM server_secrets
        WHERE key = ${key}
        LIMIT 1
      `) as Array<{ value: string }>;
      if (rows[0]?.value) out[key] = rows[0].value;
    }
    return out;
  } catch (error) {
    console.warn("[ProxVoice] global credential read skipped", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

async function persistEnvConfig(config: ProxVoiceConfig): Promise<void> {
  if (!canTryGlobalVault()) return;
  try {
    await ensureServerSecretsTable();
    await writeServerSecret("LIVEKIT_API_KEY", config.apiKey, true);
    await writeServerSecret("LIVEKIT_API_SECRET", config.apiSecret, true);
    await writeServerSecret("LIVEKIT_URL", config.url, false);
  } catch (error) {
    console.warn("[ProxVoice] global credential persist skipped", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function writeServerSecret(
  key: string,
  value: string,
  isSensitive: boolean,
): Promise<void> {
  await sql`
    INSERT INTO server_secrets (key, value, is_sensitive, updated_at)
    VALUES (${key}, ${value}, ${isSensitive}, NOW())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value,
      is_sensitive = EXCLUDED.is_sensitive,
      updated_at = NOW()
  `;
}

async function ensureServerSecretsTable(): Promise<void> {
  if (hasEnsuredTable) return;
  await sql`
    CREATE TABLE IF NOT EXISTS server_secrets (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      is_sensitive BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await hardenServerSecretsTable();
  hasEnsuredTable = true;
}

async function hardenServerSecretsTable(): Promise<void> {
  try {
    await sql`ALTER TABLE server_secrets ENABLE ROW LEVEL SECURITY`;
    await sql`
      DROP POLICY IF EXISTS server_secrets_no_user_select
      ON server_secrets
    `;
    await sql`
      CREATE POLICY server_secrets_no_user_select
      ON server_secrets
      FOR SELECT
      USING (false)
    `;
  } catch (error) {
    console.warn("[ProxVoice] server_secrets RLS hardening skipped", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function cache(value: ProxVoiceConfig | null): ProxVoiceConfig | null {
  cachedConfig = { value, expiresAt: Date.now() + cacheTtlMs };
  return value;
}

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function canTryGlobalVault(): boolean {
  return Boolean(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL);
}
