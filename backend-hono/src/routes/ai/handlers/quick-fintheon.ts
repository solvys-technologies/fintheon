// [claude-code 2026-03-10] QuickFintheon handler — chart screenshot analysis with Playwright fallback
/**
 * POST /api/ai/quick-fintheon
 * Multimodal chart analysis: bias, entries, stop, target.
 * If no image is provided, auto-captures via Playwright.
 */

import type { Context } from "hono";
import { handleHermesChat } from "../../../services/hermes-handler.js";
import {
  takeScreenshot,
  isPlaywrightReady,
} from "../../../services/screenshot-service.js";
import type {
  QuickFintheonRequest,
  QuickFintheonResult,
} from "../../../types/quick-fintheon.js";

const QUICKFINTHEON_SYSTEM = `You are QuickFintheon, a fast-action chart analyst for Priced In Capital (P.I.C.).
Analyze the provided chart screenshot and return a structured trade analysis.
Be concise and actionable — like a SnapTrader calling a live setup.

ALWAYS respond with ONLY valid JSON in this exact format (no markdown, no prose):
{
  "bias": "Bullish|Bearish|Neutral",
  "confidence": <0-100>,
  "rationale": "<1-2 sentences max>",
  "entries": {
    "entry1": { "price": "<price or level>", "reason": "<why>" },
    "entry2": { "price": "<price or level>", "reason": "<why>" }
  },
  "stopLoss": { "price": "<price or level>", "reason": "<why>" },
  "target": { "price": "<price or level>", "reason": "<why>" },
  "riskReward": "<e.g. 2.5:1>",
  "timeframe": "<e.g. 4H, 1D>",
  "keyLevels": ["<level1>", "<level2>"]
}`;

export async function handleQuickFintheon(c: Context): Promise<Response> {
  const body = await c.req
    .json<QuickFintheonRequest>()
    .catch(() => ({}) as QuickFintheonRequest);

  let imageBase64 = body.image;
  let autoScreenshot = false;

  // Strip data URI prefix if present — we need raw base64 for the content part URL
  if (imageBase64?.startsWith("data:")) {
    // Keep as-is; we'll pass it directly as image_url
  }

  // No image provided → try Playwright auto-screenshot
  if (!imageBase64) {
    const ready = await isPlaywrightReady();
    if (!ready) {
      return c.json(
        {
          error:
            "No image provided and Playwright is not available. Install playwright and run: npx playwright install chromium",
        },
        400,
      );
    }

    try {
      const shot = await takeScreenshot({ url: body.url });
      imageBase64 = `data:image/png;base64,${shot.base64}`;
      autoScreenshot = true;
    } catch (err) {
      console.error("[QuickFintheon] Screenshot failed:", err);
      return c.json(
        {
          error:
            "Auto-screenshot failed. Provide an image or ensure Playwright Chromium is installed.",
        },
        500,
      );
    }
  }

  // Build prompt text
  const algoContext = body.algoState
    ? `\n\nCurrent algo state:\n${JSON.stringify(body.algoState, null, 2)}`
    : "";

  const userText = `[SKILL:QUICKFINTHEON] Analyze the provided chart/screenshot. Provide: Bias (Bullish/Bearish/Neutral), Confidence %, Rationale, Entry 1, Entry 2, Stop Loss, Target. Be concise and actionable like a SnapTrader.${algoContext}`;

  // Multimodal content parts
  const multimodalContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    { type: "text", text: userText },
    { type: "image_url", image_url: { url: imageBase64 } },
  ];

  let rawContent: string;
  try {
    const response = await handleHermesChat({
      message: userText,
      multimodalContent,
      history: [],
      agentOverride: "pma-merged",
    });
    rawContent = response.content;
  } catch (err) {
    console.error("[QuickFintheon] Hermes call failed:", err);
    return c.json({ error: "AI analysis failed. Please try again." }, 500);
  }

  // Parse JSON response — strip potential markdown code fences
  let result: QuickFintheonResult;
  try {
    const cleaned = rawContent
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    result = JSON.parse(cleaned) as QuickFintheonResult;
  } catch {
    // Return raw text as rationale if parsing fails
    result = {
      bias: "Neutral",
      confidence: 0,
      rationale: rawContent.slice(0, 500),
      entries: {
        entry1: { price: "N/A", reason: "Parse error — see rationale" },
      },
      stopLoss: { price: "N/A", reason: "" },
      target: { price: "N/A", reason: "" },
    };
  }

  // Attach auto-captured screenshot so frontend can display it
  if (autoScreenshot && imageBase64) {
    result.screenshot = imageBase64;
  }

  return c.json(result);
}
