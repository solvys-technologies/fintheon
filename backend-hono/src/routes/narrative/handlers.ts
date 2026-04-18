// [claude-code 2026-04-05] Strands Phase 8: Replace generateText with invokeAgent
// [claude-code 2026-03-31] Added GET /api/narrative/catalysts — auto-population endpoint for NarrativeFlow
// [claude-code 2026-03-30] Narrative endpoints — threads, card-links, LLM scoring
import type { Context } from "hono";
import { invokeAgent } from "../../services/strands/index.js";
import { getSupabaseClient } from "../../config/supabase.js";

export interface ScoredCandidate {
  sourceId: string;
  sourceType: "riskflow" | "mdb-brief";
  notabilityScore: number;
  sentiment: "bullish" | "bearish";
  severity: "high" | "medium" | "low";
  tickers: string[];
  themes: string[];
  suggestedTitle: string;
  suggestedDescription: string;
  originalHeadline?: string;
}

interface RiskFlowItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  severity: string;
  tags: string[];
  publishedAt: string;
}

const RISKFLOW_PROMPT = `You are a market catalyst analyst for Priced In Capital. Score these news items for notability as market catalysts.

For each item, return a JSON object with:
- sourceId: the original item id
- notabilityScore (0-100): How notable is this as a market catalyst? 80+ = major event, 50-79 = moderate, <50 = noise
- sentiment: "bullish" or "bearish"
- severity: "high", "medium", or "low"
- tickers: Array of relevant ticker symbols (e.g., ["NQ", "ES", "AAPL"])
- themes: Array of market themes (e.g., ["rate policy", "tech earnings", "geopolitical"])
- suggestedTitle: Short catalyst title (max 50 chars)
- suggestedDescription: 1-2 sentence description

Return ONLY a JSON array, no markdown, no explanation.

Items:
`;

const BRIEF_PROMPT = `You are a market catalyst analyst for Priced In Capital. Parse this daily market brief into discrete catalyst events.

Extract each distinct market event or data point as a separate catalyst. For each:
- sourceId: "brief-0", "brief-1", etc.
- notabilityScore (0-100)
- sentiment: "bullish" or "bearish"
- severity: "high", "medium", or "low"
- tickers: relevant ticker symbols
- themes: market themes
- suggestedTitle: short title (max 50 chars)
- suggestedDescription: 1-2 sentence description

Return ONLY a JSON array, no markdown, no explanation.

Brief:
`;

const RESEARCH_DRILL_PROMPT = `You are a market research analyst for Priced In Capital. Given a highlighted phrase from a market narrative card, generate exactly 5 deeper research bullets.

Each bullet should reveal a specific, data-driven insight about the highlighted topic. Include numbers, percentages, dates, or specific entities where possible.

Return a JSON array of 5 objects, each with:
- boldPhrase: A bold key insight (max 80 chars, e.g. "Supply chain repricing underway")
- explanation: Detailed explanation with specific facts (max 300 chars)

Return ONLY a JSON array, no markdown, no explanation.
`;

const BULLISH_KEYWORDS = [
  "cut",
  "rally",
  "surge",
  "soar",
  "jump",
  "gain",
  "rise",
  "boost",
];

function fallbackScore(item: RiskFlowItem): ScoredCandidate {
  const headlineLower = item.headline.toLowerCase();
  const isBullish = BULLISH_KEYWORDS.some((kw) => headlineLower.includes(kw));
  const severityMap: Record<string, number> = { high: 80, medium: 50, low: 20 };

  return {
    sourceId: item.id,
    sourceType: "riskflow",
    notabilityScore: severityMap[item.severity] ?? 50,
    sentiment: isBullish ? "bullish" : "bearish",
    severity: (item.severity as ScoredCandidate["severity"]) || "medium",
    tickers: item.tags.filter((t) => /^[A-Z]{1,5}$/.test(t)),
    themes: item.tags.filter((t) => !/^[A-Z]{1,5}$/.test(t)),
    suggestedTitle: item.headline.slice(0, 50),
    suggestedDescription: item.summary.slice(0, 200),
    originalHeadline: item.headline,
  };
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
}

async function callLlm(
  prompt: string,
): Promise<{ parsed: unknown[] | null; provider: string }> {
  try {
    const { text } = await invokeAgent({
      systemPrompt: "You are a market catalyst analyst for Priced In Capital.",
      userPrompt: prompt,
      model: { temperature: 0.3, maxTokens: 2048 },
    });
    const cleaned = stripMarkdownFences(text);
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("LLM response is not an array");
    return { parsed, provider: "strands-vproxy" };
  } catch (err) {
    console.error("[Narrative] LLM call or parse failed:", err);
    return { parsed: null, provider: "strands-vproxy" };
  }
}

function toScoredCandidate(
  raw: Record<string, unknown>,
  sourceType: ScoredCandidate["sourceType"],
): ScoredCandidate {
  return {
    sourceId: String(raw.sourceId ?? ""),
    sourceType,
    notabilityScore: Number(raw.notabilityScore) || 50,
    sentiment: raw.sentiment === "bullish" ? "bullish" : "bearish",
    severity: (["high", "medium", "low"].includes(raw.severity as string)
      ? raw.severity
      : "medium") as ScoredCandidate["severity"],
    tickers: Array.isArray(raw.tickers) ? raw.tickers.map(String) : [],
    themes: Array.isArray(raw.themes) ? raw.themes.map(String) : [],
    suggestedTitle: String(raw.suggestedTitle ?? "").slice(0, 50),
    suggestedDescription: String(raw.suggestedDescription ?? "").slice(0, 200),
    originalHeadline: raw.originalHeadline
      ? String(raw.originalHeadline)
      : undefined,
  };
}

/**
 * POST /api/narrative/score-riskflow
 * Score RiskFlow items as catalyst candidates via LLM
 */
export async function scoreRiskflow(c: Context) {
  try {
    const { items } = await c.req.json<{ items: RiskFlowItem[] }>();
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ error: "items array required" }, 400);
    }

    const batch = items.slice(0, 20);
    const itemsPayload = batch.map(
      ({ id, headline, summary, source, severity, tags }) => ({
        id,
        headline,
        summary,
        source,
        severity,
        tags,
      }),
    );

    const { parsed, provider } = await callLlm(
      RISKFLOW_PROMPT + JSON.stringify(itemsPayload, null, 2),
    );

    let scored: ScoredCandidate[];
    if (parsed) {
      scored = parsed.map((raw) => {
        const candidate = toScoredCandidate(
          raw as Record<string, unknown>,
          "riskflow",
        );
        const original = batch.find((i) => i.id === candidate.sourceId);
        if (original) candidate.originalHeadline = original.headline;
        return candidate;
      });
    } else {
      scored = batch.map(fallbackScore);
    }

    return c.json({ scored, provider });
  } catch (err) {
    console.error("[Narrative] scoreRiskflow error:", err);
    return c.json({ error: "Failed to score items" }, 500);
  }
}

/**
 * POST /api/narrative/score-brief
 * Parse and score a daily brief into catalyst candidates via LLM
 */
export async function scoreBrief(c: Context) {
  try {
    const { briefText } = await c.req.json<{ briefText: string }>();
    if (!briefText || typeof briefText !== "string") {
      return c.json({ error: "briefText string required" }, 400);
    }

    const { parsed, provider } = await callLlm(BRIEF_PROMPT + briefText);

    let scored: ScoredCandidate[];
    if (parsed) {
      scored = parsed.map((raw) =>
        toScoredCandidate(raw as Record<string, unknown>, "mdb-brief"),
      );
    } else {
      scored = [
        {
          sourceId: "brief-0",
          sourceType: "mdb-brief",
          notabilityScore: 50,
          sentiment: "bearish",
          severity: "medium",
          tickers: [],
          themes: [],
          suggestedTitle: "Daily Brief",
          suggestedDescription: briefText.slice(0, 200),
        },
      ];
    }

    return c.json({ scored, provider });
  } catch (err) {
    console.error("[Narrative] scoreBrief error:", err);
    return c.json({ error: "Failed to score brief" }, 500);
  }
}

/**
 * POST /api/narrative/research-drill
 * Generate 5 deeper research bullets for a highlighted phrase
 */
export async function researchDrill(c: Context) {
  try {
    const {
      highlightedText,
      parentTitle,
      parentDescription,
      riskCategory,
      sentiment,
    } = await c.req.json<{
      highlightedText: string;
      parentTitle: string;
      parentDescription: string;
      riskCategory: string;
      sentiment: string;
    }>();

    if (!highlightedText)
      return c.json({ error: "highlightedText required" }, 400);

    const prompt =
      RESEARCH_DRILL_PROMPT +
      `\nHighlighted phrase: "${highlightedText}"` +
      `\nParent card: ${parentTitle}` +
      `\nContext: ${parentDescription}` +
      `\nRisk category: ${riskCategory}` +
      `\nMarket sentiment: ${sentiment}`;

    const { parsed, provider } = await callLlm(prompt);

    let bullets: Array<{ boldPhrase: string; explanation: string }>;
    if (parsed) {
      bullets = parsed.map((raw: any) => ({
        boldPhrase: String(raw.boldPhrase ?? raw.key ?? "").slice(0, 80),
        explanation: String(raw.explanation ?? raw.detail ?? "").slice(0, 300),
      }));
    } else {
      bullets = [
        {
          boldPhrase: highlightedText,
          explanation: "AI analysis unavailable — try again.",
        },
      ];
    }

    const formatted = bullets.map((b, i) => ({
      id: `drill-${Date.now()}-${i}`,
      boldPhrase: b.boldPhrase,
      explanation: b.explanation,
      source: "ai" as const,
      highlightable: true,
    }));

    return c.json({ bullets: formatted, provider });
  } catch (err) {
    console.error("[Narrative] researchDrill error:", err);
    return c.json({ error: "Failed to generate research" }, 500);
  }
}

/**
 * GET /api/narrative/threads
 * Return all narrative threads from DB (the 10 core narratives)
 */
export async function getThreads(c: Context) {
  const sb = getSupabaseClient();
  if (!sb) return c.json({ threads: [] });

  try {
    const { data, error } = await sb
      .from("narrative_threads")
      .select("slug, title, description, color, status, sort_order, keywords")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return c.json({ threads: data ?? [] });
  } catch (err) {
    console.error("[Narrative] getThreads error:", err);
    return c.json({ threads: [] });
  }
}

/**
 * GET /api/narrative/card-links
 * Return all narrative_card_links (card_id → thread_slug mappings)
 * Optional ?card_ids=id1,id2 to filter
 */
export async function getCardLinks(c: Context) {
  const sb = getSupabaseClient();
  if (!sb) return c.json({ links: [] });

  try {
    const cardIdsParam = c.req.query("card_ids");
    let query = sb
      .from("narrative_card_links")
      .select("card_id, thread_slug, confidence");

    if (cardIdsParam) {
      const ids = cardIdsParam.split(",").filter(Boolean);
      if (ids.length > 0) query = query.in("card_id", ids);
    }

    const { data, error } = await query;
    if (error) throw error;
    return c.json({ links: data ?? [] });
  } catch (err) {
    console.error("[Narrative] getCardLinks error:", err);
    return c.json({ links: [] });
  }
}

/**
 * GET /api/narrative/catalysts/:id — single catalyst lookup for mobile DetailSheet (S25)
 * Returns the same shape as getCatalysts items plus narrativeThreads hydrated with labels.
 */
export async function getCatalystById(c: Context) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "catalystId required" }, 400);

  const sb = getSupabaseClient();
  if (!sb) return c.json({ error: "Database unavailable" }, 503);

  try {
    const { data: item, error } = await sb
      .from("scored_riskflow_items")
      .select(
        "tweet_id, headline, body, url, symbols, tags, sentiment, iv_score, macro_level, published_at, promoted_at, category, status, price_brain_score, risk_type, market_impact, agent_note, image_url",
      )
      .eq("tweet_id", id)
      .maybeSingle();

    if (error) throw error;
    if (!item) return c.json({ error: "Catalyst not found" }, 404);

    const { data: links } = await sb
      .from("narrative_card_links")
      .select("thread_slug, confidence")
      .eq("card_id", item.tweet_id);

    const pbs = item.price_brain_score as Record<string, unknown> | null;
    const threads = (links ?? []).map((l) => l.thread_slug);
    const macroLevel = (item.macro_level as number) ?? 1;
    const severity =
      macroLevel >= 3 ? "high" : macroLevel >= 2 ? "medium" : "low";
    const sentimentVal = String(
      item.sentiment ?? pbs?.sentiment ?? "bearish",
    ).toLowerCase();

    const catalyst = {
      id: item.tweet_id,
      title: (item.headline ?? "").slice(0, 160),
      description: item.body ?? item.headline ?? "",
      date: item.published_at,
      sentiment: sentimentVal.includes("bull") ? "bullish" : "bearish",
      severity,
      source: "riskflow" as const,
      sourceUrl: (item as Record<string, unknown>).url ?? null,
      imageUrl: (item as Record<string, unknown>).image_url ?? null,
      ivScore: item.iv_score ?? null,
      narrativeThreads: threads,
      narrative: threads[0] ?? null,
      tags: item.tags ?? [],
      category: item.category ?? "macroeconomic",
      status: item.status ?? "active",
      marketImpact: item.market_impact ?? null,
      agentNote: item.agent_note ?? null,
      riskflowItemId: item.tweet_id,
    };

    return c.json({ catalyst });
  } catch (err) {
    console.error("[Narrative] getCatalystById error:", err);
    return c.json({ error: "Failed to load catalyst" }, 500);
  }
}

/**
 * GET /api/narrative/catalysts
 * Auto-population endpoint for NarrativeFlow — returns promoted scored items
 * with narrative thread assignments, ready to render as CatalystCards.
 * Query params:
 *   ?since=ISO  — only items promoted after this timestamp (incremental fetch)
 *   ?days=7     — look back N days (default 7)
 */
export async function getCatalysts(c: Context) {
  const sb = getSupabaseClient();
  if (!sb) return c.json({ catalysts: [] });

  try {
    const sinceParam = c.req.query("since");
    const daysParam = parseInt(c.req.query("days") ?? "7", 10);
    const lookback = new Date(
      Date.now() - daysParam * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Fetch promoted scored items with their narrative thread links
    // Only items with IV >= 5.0 qualify for NarrativeFlow
    let query = sb
      .from("scored_riskflow_items")
      .select(
        "tweet_id, headline, body, symbols, tags, sentiment, iv_score, macro_level, published_at, promoted_at, category, status, price_brain_score, risk_type, market_impact, agent_note",
      )
      .not("promoted_at", "is", null)
      .gte("iv_score", 5.0)
      .gte("published_at", lookback)
      .order("published_at", { ascending: false })
      .limit(200);

    if (sinceParam) {
      query = query.gt("promoted_at", sinceParam);
    }

    const { data: items, error } = await query;
    if (error) throw error;
    if (!items || items.length === 0) return c.json({ catalysts: [] });

    // Fetch narrative_card_links for these items
    const tweetIds = items.map((i) => i.tweet_id);
    const { data: links } = await sb
      .from("narrative_card_links")
      .select("card_id, thread_slug, confidence")
      .in("card_id", tweetIds);

    // Build card_id → thread_slugs map
    const threadMap = new Map<string, string[]>();
    for (const link of links ?? []) {
      const existing = threadMap.get(link.card_id) ?? [];
      existing.push(link.thread_slug);
      threadMap.set(link.card_id, existing);
    }

    // Map to CatalystCard-compatible shape
    const catalysts = items.map((item) => {
      const pbs = item.price_brain_score as Record<string, any> | null;
      const threads = threadMap.get(item.tweet_id) ?? [];
      const macroLevel = item.macro_level ?? 1;
      const severity =
        macroLevel >= 4
          ? "high"
          : macroLevel >= 3
            ? "high"
            : macroLevel >= 2
              ? "medium"
              : "low";
      const sentimentVal = (
        item.sentiment ??
        pbs?.sentiment ??
        "bearish"
      ).toLowerCase();

      return {
        id: item.tweet_id,
        title: (item.headline ?? "").slice(0, 120),
        description: item.body ?? item.headline ?? "",
        date: item.published_at,
        sentiment: sentimentVal.includes("bull") ? "bullish" : "bearish",
        severity,
        source: "riskflow" as const,
        narrativeIds: threads,
        narrativeThreads: threads,
        isGhost: false,
        templateType: null,
        position: null,
        tags: item.tags ?? [],
        category: item.category ?? "macroeconomic",
        riskflowItemId: item.tweet_id,
        marketImpact: item.market_impact ?? null,
        narrative: threads[0] ?? null,
        status: item.status ?? "active",
        drillDepth: 0,
        createdAt: item.promoted_at,
        updatedAt: item.promoted_at,
      };
    });

    return c.json({ catalysts });
  } catch (err) {
    console.error("[Narrative] getCatalysts error:", err);
    return c.json({ catalysts: [] });
  }
}
