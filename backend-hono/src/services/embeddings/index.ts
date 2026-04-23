// [claude-code 2026-04-23] S32-T2 Harper Vision — minimal OpenAI embedding helper
/**
 * Returns a 1536-dim embedding via OpenAI text-embedding-3-small.
 * If OPENAI_API_KEY is missing, returns null so callers can store null
 * without breaking (pgvector column is nullable and backfill-ready).
 */
import { createLogger } from "../../lib/logger.js";

const log = createLogger("Embeddings");

const MODEL = "text-embedding-3-small";
const ENDPOINT = "https://api.openai.com/v1/embeddings";
const TIMEOUT_MS = 10_000;

export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: MODEL, input: trimmed.slice(0, 4000) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!resp.ok) {
      log.warn("embed failed", { status: resp.status });
      return null;
    }

    const json = (await resp.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    return json.data?.[0]?.embedding ?? null;
  } catch (err) {
    log.warn("embed error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
