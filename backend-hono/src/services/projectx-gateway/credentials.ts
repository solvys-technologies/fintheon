import { isPoolAvailable, query } from "../../db/optimized.js";
import {
  decryptApiKey,
  encryptApiKey,
  maskApiKey,
} from "../ai/api-key-crypto.js";
import { readLocalProjectX, writeLocalProjectX } from "./local-config.js";
import type { ProjectXConnectInput, ProjectXCredentials } from "./types.js";

interface ConnectionRow {
  username: string | null;
  encrypted_api_key: string | null;
  active_account_id: string | null;
}

function envCredentials(userId: string): ProjectXCredentials | null {
  const username = process.env.PROJECTX_USERNAME?.trim();
  const apiKey = process.env.PROJECTX_API_KEY?.trim();
  if (!username && !apiKey) return null;
  return {
    userId,
    username,
    apiKey,
    activeAccountId: process.env.PROJECTX_ACCOUNT_ID?.trim(),
    source: "env",
  };
}

async function dbCredentials(
  userId: string,
): Promise<ProjectXCredentials | null> {
  if (!isPoolAvailable()) return null;
  try {
    const result = await query<ConnectionRow>(
      `SELECT username, encrypted_api_key, active_account_id
       FROM journal_broker_connections
       WHERE user_id = $1 AND provider = 'projectx'
       LIMIT 1`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const apiKey = row.encrypted_api_key
      ? decryptApiKey(row.encrypted_api_key)
      : undefined;
    return {
      userId,
      username: row.username ?? undefined,
      apiKey,
      activeAccountId: row.active_account_id ?? undefined,
      source: "db",
    };
  } catch {
    return null;
  }
}

function localCredentials(userId: string): ProjectXCredentials | null {
  const local = readLocalProjectX(userId);
  if (!local) return null;
  return {
    userId,
    username: local.username,
    apiKey: local.apiKey,
    activeAccountId: local.activeAccountId,
    source: "local",
  };
}

export async function resolveProjectXCredentials(
  userId: string,
): Promise<ProjectXCredentials | null> {
  return (
    envCredentials(userId) ??
    (await dbCredentials(userId)) ??
    localCredentials(userId)
  );
}

export async function saveProjectXCredentials(
  userId: string,
  input: ProjectXConnectInput,
): Promise<{ backendSaved: boolean; maskedKey: string }> {
  writeLocalProjectX(userId, input);

  if (!isPoolAvailable()) {
    return { backendSaved: false, maskedKey: maskApiKey(input.apiKey) };
  }

  const encryptedApiKey = encryptApiKey(input.apiKey);
  await query(
    `INSERT INTO journal_broker_connections (
       user_id, provider, username, encrypted_api_key, active_account_id, status
     )
     VALUES ($1, 'projectx', $2, $3, $4, 'connected')
     ON CONFLICT (user_id, provider) DO UPDATE
       SET username = EXCLUDED.username,
           encrypted_api_key = EXCLUDED.encrypted_api_key,
           active_account_id = COALESCE(EXCLUDED.active_account_id, journal_broker_connections.active_account_id),
           status = 'connected',
           last_error = NULL,
           updated_at = NOW()`,
    [userId, input.username, encryptedApiKey, input.activeAccountId ?? null],
  );

  return { backendSaved: true, maskedKey: maskApiKey(input.apiKey) };
}

export function missingCredentialFields(
  credentials: ProjectXCredentials | null,
): string[] {
  const missing: string[] = [];
  if (!credentials?.username) missing.push("userName");
  if (!credentials?.apiKey) missing.push("apiKey");
  return missing;
}
