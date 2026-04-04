// [claude-code 2026-04-04] Secrets vault — loads env vars from Supabase server_secrets table
// Eliminates .env file dependency for API keys, cron config, etc.
// Only DATABASE_URL needed locally (embedded in setup script) — vault pulls everything else.
// Uses direct Postgres (pg Pool) so SUPABASE_SERVICE_ROLE_KEY is NOT required to bootstrap.

import pg from 'pg';
import { createLogger } from '../lib/logger.js';

const log = createLogger('SecretsVault');

/**
 * Load all server secrets from Supabase via direct Postgres and inject into process.env.
 * Skips keys that already have a value in process.env (local overrides win).
 *
 * Only requires DATABASE_URL to be set — no Supabase client or service role key needed.
 * This breaks the chicken-and-egg: DATABASE_URL is a public pooler string baked into
 * the setup script, and the vault fills in everything else (including SUPABASE_SERVICE_ROLE_KEY).
 */
export async function loadSecretsFromVault(): Promise<number> {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    log.warn('DATABASE_URL not set — vault disabled, using local env only');
    return 0;
  }

  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });

  try {
    const { rows } = await pool.query<{ key: string; value: string; is_sensitive: boolean }>(
      'SELECT key, value, is_sensitive FROM server_secrets',
    );

    if (!rows || rows.length === 0) {
      log.warn('Secrets vault is empty — no secrets loaded');
      return 0;
    }

    let loaded = 0;
    let skipped = 0;

    for (const row of rows) {
      if (process.env[row.key]) {
        skipped++;
        continue;
      }
      process.env[row.key] = row.value;
      loaded++;
    }

    const sensitiveCount = rows.filter(r => r.is_sensitive).length;
    log.info(`Vault loaded: ${loaded} injected, ${skipped} skipped (local override), ${sensitiveCount} sensitive`);

    return loaded;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('Failed to read secrets vault — falling back to local env', { error: msg });
    return 0;
  } finally {
    await pool.end().catch(() => {});
  }
}
