// [claude-code 2026-04-23] S32-T3 Harper Vision — route description through VProxy → Ollama chain
// [claude-code 2026-04-23] S32-T2 Harper Vision — Claude Opus 4.6 vision call via VProxy
/**
 * Vision describe helper. Sends a PNG frame to Claude Opus 4.6 via VProxy
 * and returns a terse trading-desk scene description. When VProxy is
 * unavailable, chain falls through to the Ollama-Qwen text fallback — which
 * cannot see images — so the helper returns null. Caller handles null as
 * "no description" and a routine can backfill later.
 */
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { getVProxyHealth } from "./anthropic-client.js";
import { getNextBaseUrl } from "../strands/provider.js";
import { isOllamaFallbackEnabled } from "../ai/ollama-hermes-client.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("VProxyVision");

const DEFAULT_API_KEY = "CLI_PROXY_API_KEY";
const VISION_MODEL = "claude-opus-4-6";
const MAX_CHARS = 120;
const TIMEOUT_MS = 12_000;

const DESCRIBE_PROMPT =
  "Describe this trading-desk screen in ≤120 chars. Identify: app in focus, " +
  "visible symbol, chart timeframe, any P&L or order ticket visible. Terse.";

export async function describeTradingDeskFrame(
  base64Png: string,
): Promise<string | null> {
  const health = await getVProxyHealth();
  if (!health.available) return null;

  try {
    const apiKey = process.env.VPROXY_API_KEY || DEFAULT_API_KEY;
    const anthropic = createAnthropic({
      apiKey,
      baseURL: getNextBaseUrl(),
    });

    const { text } = await generateText({
      model: anthropic(VISION_MODEL),
      maxOutputTokens: 160,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: Buffer.from(base64Png, "base64") },
            { type: "text", text: DESCRIBE_PROMPT },
          ],
        },
      ],
    });

    const cleaned = text.trim().replace(/\s+/g, " ").slice(0, MAX_CHARS);
    return cleaned || null;
  } catch (err) {
    log.warn("describe frame failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
