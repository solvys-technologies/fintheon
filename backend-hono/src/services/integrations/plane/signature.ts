// [claude-code 2026-05-06] S60-T4: HMAC-SHA256 signature verification for Plane inbound webhooks
import { createHmac } from "node:crypto";

const SKEW_WINDOW_S = 300;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function lookupSecret(keyId: string): string | null {
  const raw = process.env.PLANE_WEBHOOK_SECRETS;
  if (!raw) return null;
  try {
    const secrets = JSON.parse(raw) as Record<string, string>;
    return secrets[keyId] ?? null;
  } catch {
    return null;
  }
}

export interface SignatureVerificationResult {
  valid: boolean;
  reason?: "missing_secret" | "unknown_key_id" | "stale_timestamp" | "invalid_timestamp" | "malformed_signature" | "signature_mismatch";
}

export function verifyPlaneSignature(opts: {
  rawBody: string;
  signatureHeader: string;
  timestamp: string;
  keyId: string;
}): SignatureVerificationResult {
  const { rawBody, signatureHeader, timestamp, keyId } = opts;

  const normalizedKid = keyId || "default";

  const secret = lookupSecret(normalizedKid);
  if (secret === null) return { valid: false, reason: "unknown_key_id" };

  const ts = Number(timestamp);
  if (Number.isNaN(ts)) return { valid: false, reason: "invalid_timestamp" };

  const nowS = Math.floor(Date.now() / 1000);
  if (Math.abs(nowS - ts) > SKEW_WINDOW_S) {
    return { valid: false, reason: "stale_timestamp" };
  }

  const canonical = `${timestamp}.${rawBody}`;
  const expectedDigest = createHmac("sha256", secret)
    .update(canonical)
    .digest("hex");

  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) {
    return { valid: false, reason: "malformed_signature" };
  }
  const providedDigest = signatureHeader.slice(prefix.length);

  if (!timingSafeEqual(expectedDigest, providedDigest)) {
    return { valid: false, reason: "signature_mismatch" };
  }

  return { valid: true };
}
