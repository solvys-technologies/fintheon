// [claude-code 2026-05-05] Added getUserApiKey() to resolve per-user BYOK for chat inference.
// [claude-code 2026-05-03] S58-T1: encrypted user AI API key storage.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "../../config/supabase.js";
import { getLocalProviderKey } from "../hermes/local-user-config.js";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function getEncryptionKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("ENCRYPTION_SECRET not set");
  return createHash("sha256").update(secret).digest();
}

export function encryptApiKey(apiKey: string): string {
  if (!apiKey.trim()) throw new Error("apiKey is required");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptApiKey(payload: string): string {
  const [ivRaw, authTagRaw, encryptedRaw] = payload.split(".");
  if (!ivRaw || !authTagRaw || !encryptedRaw) {
    throw new Error("invalid encrypted api key payload");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTagRaw, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 12) return "****";
  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
}

/** Resolve a per-user API key from the encrypted store. Returns null if not found or DB unavailable. */
export async function getUserApiKey(
  userId: string,
  provider: string,
): Promise<string | null> {
  if (!userId || userId === "anonymous") return null;
  if (provider !== "deepseek" && provider !== "opencode-go") return null;

  // Local-user (bypass auth) and no-DB modes resolve from Hermes-local config.
  if (userId === "local-user" || !isSupabaseConfigured()) {
    return getLocalProviderKey(userId, provider);
  }

  try {
    const sb = getSupabaseClient()!;
    const { data, error } = await sb
      .from("user_api_keys")
      .select("encrypted_key")
      .eq("user_id", userId)
      .eq("provider", provider)
      .maybeSingle();
    if (error || !data?.encrypted_key) {
      return getLocalProviderKey(userId, provider);
    }
    return decryptApiKey(String(data.encrypted_key));
  } catch {
    return getLocalProviderKey(userId, provider);
  }
}
