// [claude-code 2026-04-24] S36 ClusterBeam — cluster summarizer service.
// In-memory cache (10-min TTL) → Supabase `cluster_summaries` → Strands invokeAgent fallback chain.
// When every LLM provider is unreachable, returns a deterministic non-AI summary so the panel
// never renders a dead header. All caches are keyed by sha1(sorted cardIds) — re-open = instant.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { invokeAgent } from "../strands/index.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import type {
  ClusterSummary,
  ClusterSummaryCard,
  ClusterSummaryInput,
  ClusterSummaryResponse,
  DominantSentiment,
} from "../../types/cluster-summary.js";

const log = createLogger("ClusterSummarizer");

const TTL_MS = 10 * 60 * 1000;
const MAX_CARDS_PER_CALL = 60;

interface CacheEntry {
  value: ClusterSummary;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();

function hashCards(cards: ClusterSummaryCard[]): string {
  const ids = cards
    .map((c) => c.id)
    .filter((id) => typeof id === "string" && id.length > 0)
    .sort();
  return createHash("sha1").update(ids.join(",")).digest("hex");
}

function readMemory(hash: string): ClusterSummary | null {
  const entry = memoryCache.get(hash);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(hash);
    return null;
  }
  return entry.value;
}

function writeMemory(hash: string, value: ClusterSummary): void {
  memoryCache.set(hash, { value, expiresAt: Date.now() + TTL_MS });
}

async function readSupabase(hash: string): Promise<ClusterSummary | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("cluster_summaries")
      .select("summary_json")
      .eq("group_hash", hash)
      .maybeSingle();
    if (error || !data) return null;
    const summary = data.summary_json as ClusterSummary;
    if (!summary?.one_liner) return null;
    return summary;
  } catch (err) {
    log.warn("supabase read failed", { error: String(err) });
    return null;
  }
}

async function writeSupabase(
  hash: string,
  input: ClusterSummaryInput,
  summary: ClusterSummary,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.from("cluster_summaries").upsert(
      {
        group_hash: hash,
        group_id: input.groupId,
        narrative_slug: input.narrativeSlug ?? null,
        summary_json: summary,
      },
      { onConflict: "group_hash" },
    );
  } catch (err) {
    log.warn("supabase write failed", { error: String(err) });
  }
}

let cachedSystemPrompt: string | null = null;

async function loadSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const here = dirname(fileURLToPath(import.meta.url));
  const promptPath = join(
    here,
    "..",
    "ai",
    "agent-instructions",
    "cluster-summarizer.md",
  );
  try {
    cachedSystemPrompt = await readFile(promptPath, "utf-8");
  } catch (err) {
    log.warn("prompt file missing, using inline fallback", {
      error: String(err),
    });
    cachedSystemPrompt =
      "You summarize a cluster of headlines tied to one narrative thread. " +
      "Return ONLY a JSON object with keys: one_liner (string), bullets (string[]), " +
      "dominant_sentiment ('bullish'|'bearish'|'mixed'), " +
      "dominant_sentiment_confidence (number 0-1), notable_tickers (string[]).";
  }
  return cachedSystemPrompt;
}

function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
}

function parseSummary(raw: string): ClusterSummary | null {
  try {
    const parsed = JSON.parse(stripFences(raw));
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;
    const one_liner = typeof p.one_liner === "string" ? p.one_liner.trim() : "";
    const bullets = Array.isArray(p.bullets)
      ? p.bullets.filter((b): b is string => typeof b === "string").slice(0, 5)
      : [];
    const sentiment = p.dominant_sentiment;
    const dominant_sentiment: DominantSentiment =
      sentiment === "bullish" ||
      sentiment === "bearish" ||
      sentiment === "mixed"
        ? sentiment
        : "mixed";
    const rawConf = Number(p.dominant_sentiment_confidence);
    const dominant_sentiment_confidence = Number.isFinite(rawConf)
      ? Math.max(0, Math.min(1, rawConf))
      : 0.5;
    const notable_tickers = Array.isArray(p.notable_tickers)
      ? p.notable_tickers
          .filter((t): t is string => typeof t === "string")
          .slice(0, 6)
      : [];
    if (!one_liner || bullets.length < 2) return null;
    return {
      one_liner,
      bullets,
      dominant_sentiment,
      dominant_sentiment_confidence,
      notable_tickers,
    };
  } catch {
    return null;
  }
}

async function summarizeViaLlm(
  input: ClusterSummaryInput,
): Promise<ClusterSummary | null> {
  const cards = input.cards.slice(0, MAX_CARDS_PER_CALL);
  const payload = {
    narrative: input.narrativeTitle ?? input.narrativeSlug ?? "Unspecified",
    count: cards.length,
    cards: cards.map((c) => ({
      title: c.title,
      sentiment: c.sentiment,
      severity: c.severity,
      date: c.date,
      iv: c.ivScore,
    })),
  };
  const systemPrompt = await loadSystemPrompt();
  try {
    const { text } = await invokeAgent({
      systemPrompt,
      userPrompt: JSON.stringify(payload, null, 2),
      model: { temperature: 0.2, maxTokens: 512 },
    });
    return parseSummary(text);
  } catch (err) {
    log.warn("llm summarize failed", { error: String(err) });
    return null;
  }
}

function deterministicSummary(input: ClusterSummaryInput): ClusterSummary {
  const cards = input.cards;
  const narrative =
    input.narrativeTitle ?? input.narrativeSlug ?? "this thread";

  const dates = cards
    .map((c) => c.date)
    .filter((d): d is string => typeof d === "string" && d.length > 0)
    .sort();
  const first = dates[0]?.slice(0, 10);
  const last = dates[dates.length - 1]?.slice(0, 10);
  const span = first && last && first !== last ? `${first} → ${last}` : first;

  const countsBull = cards.filter((c) => c.sentiment === "bullish").length;
  const countsBear = cards.filter((c) => c.sentiment === "bearish").length;
  const total = countsBull + countsBear;
  const dominant_sentiment: DominantSentiment =
    total === 0
      ? "mixed"
      : countsBull > countsBear * 1.3
        ? "bullish"
        : countsBear > countsBull * 1.3
          ? "bearish"
          : "mixed";
  const dominant_sentiment_confidence =
    total === 0 ? 0 : Math.abs(countsBull - countsBear) / Math.max(total, 1);

  const tickerRegex = /\b([A-Z]{1,5})\b/g;
  const tickerCounts = new Map<string, number>();
  for (const card of cards) {
    const matches = card.title.match(tickerRegex);
    if (!matches) continue;
    for (const t of matches) {
      if (t.length < 2 || t.length > 5) continue;
      tickerCounts.set(t, (tickerCounts.get(t) ?? 0) + 1);
    }
  }
  const notable_tickers = [...tickerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([ticker]) => ticker);

  const topTitles = [...cards]
    .sort((a, b) => {
      const rank = { high: 3, medium: 2, low: 1 } as const;
      return (
        (rank[b.severity ?? "low"] ?? 0) - (rank[a.severity ?? "low"] ?? 0)
      );
    })
    .slice(0, 3)
    .map((c) => c.title.slice(0, 90));

  return {
    one_liner: `${cards.length} items about ${narrative}${span ? ` between ${span}` : ""}.`,
    bullets:
      topTitles.length >= 2
        ? topTitles
        : ["Cluster summary unavailable (AI offline)", ...topTitles],
    dominant_sentiment,
    dominant_sentiment_confidence,
    notable_tickers,
  };
}

export async function summarizeCluster(
  input: ClusterSummaryInput,
): Promise<ClusterSummaryResponse> {
  if (!Array.isArray(input.cards) || input.cards.length === 0) {
    throw new Error("cards array required");
  }

  const hash = hashCards(input.cards);

  const mem = readMemory(hash);
  if (mem) {
    return { ...mem, cached: true, ts: new Date().toISOString() };
  }

  const remote = await readSupabase(hash);
  if (remote) {
    writeMemory(hash, remote);
    return { ...remote, cached: true, ts: new Date().toISOString() };
  }

  const live = await summarizeViaLlm(input);
  if (live) {
    writeMemory(hash, live);
    void writeSupabase(hash, input, live);
    return { ...live, cached: false, ts: new Date().toISOString() };
  }

  const fallback = deterministicSummary(input);
  writeMemory(hash, fallback);
  return { ...fallback, cached: false, ts: new Date().toISOString() };
}
