// [claude-code 2026-04-19] S24-T2: Lexicon Proposer — scans last-24h scored items
// tagged geopolitical or commentator, clusters repeated phrases missing from
// lexicon_keywords, and files a proposal row per cluster.
//
// Scheduled externally by T4 (2h monitoring cron). This module just exports the
// routine; it does NOT register its own timer. Soft-fails everywhere the T1
// tables aren't yet present.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import {
  fetchActiveNarratives,
  matchNarratives,
  type ActiveNarrative,
  type NarrativeStance,
} from "./narrative-sentiment.js";
import type { ParsedHeadline, NewsSource } from "../../types/news-analysis.js";

const log = createLogger("LexiconProposer");
const dlog = (msg: string): void => {
  if (process.env.SCORING_V4_VERBOSE === "true") log.info(`[soft] ${msg}`);
};

const LOOKBACK_HOURS = 24;
const MIN_OCCURRENCES = 3;
const MIN_DISTINCT_SOURCES = 2;
const EVIDENCE_PER_PROPOSAL = 5;
const MAX_PROPOSALS_PER_RUN = 20;

const STOPWORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being",
  "to","of","in","on","at","by","for","with","from","as","into",
  "and","or","but","if","then","so","that","this","these","those",
  "it","its","he","she","they","we","you","i","his","her","their",
  "says","said","say","tells","told","per","via","amp","but",
  "will","would","could","should","may","might","can","has","have","had",
  "there","here","when","what","who","how","why",
]);

interface ScoredRow {
  tweet_id: string;
  headline: string | null;
  symbols: string[] | null;
  tags: string[] | null;
  source: string | null;
  sentiment: string | null;
  iv_score: number | null;
  analyzed_at: string | null;
}

interface PhraseCluster {
  phrase: string;
  count: number;
  sources: Set<string>;
  evidence: ScoredRow[];
}

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s$%.-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Emit 2-gram and 3-gram phrases from a tokenized headline. Only n-grams that
 * don't contain any stopwords survive (they're already filtered in normalize).
 */
function ngrams(tokens: string[], n: number): string[] {
  if (tokens.length < n) return [];
  const out: string[] = [];
  for (let i = 0; i + n <= tokens.length; i++) {
    out.push(tokens.slice(i, i + n).join(" "));
  }
  return out;
}

async function fetchRecentGeoCommentaryItems(): Promise<ScoredRow[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const since = new Date(
    Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000,
  ).toISOString();
  try {
    const { data, error } = await sb
      .from("scored_riskflow_items")
      .select(
        "tweet_id,headline,symbols,tags,source,sentiment,iv_score,analyzed_at",
      )
      .gte("analyzed_at", since)
      .gte("iv_score", 4)
      .limit(500);
    if (error) {
      dlog(`fetchRecentGeoCommentaryItems soft-fail: ${error.message}`);
      return [];
    }
    // Filter to geopolitical / commentator tags client-side (tags is a text[])
    return ((data as ScoredRow[]) ?? []).filter((r) => {
      const tags = (r.tags ?? []).map((t) => t.toLowerCase());
      return tags.some(
        (t) =>
          t.startsWith("geopolitical") ||
          t === "commentator" ||
          t === "commentary" ||
          t.startsWith("subj:"),
      );
    });
  } catch (err) {
    dlog(`fetchRecentGeoCommentaryItems threw: ${String(err)}`);
    return [];
  }
}

async function fetchExistingLexicon(): Promise<Set<string>> {
  const sb = getSupabaseClient();
  if (!sb) return new Set();
  try {
    const { data, error } = await sb
      .from("lexicon_keywords")
      .select("keyword")
      .limit(5000);
    if (error) {
      dlog(`fetchExistingLexicon soft-fail: ${error.message}`);
      return new Set();
    }
    return new Set(
      ((data as { keyword: string }[]) ?? []).map((r) =>
        (r.keyword || "").toLowerCase().trim(),
      ),
    );
  } catch (err) {
    dlog(`fetchExistingLexicon threw: ${String(err)}`);
    return new Set();
  }
}

function clusterPhrases(
  items: ScoredRow[],
  existing: Set<string>,
): PhraseCluster[] {
  const map = new Map<string, PhraseCluster>();
  for (const item of items) {
    const text = item.headline || "";
    const tokens = normalize(text);
    const phrases = [...ngrams(tokens, 2), ...ngrams(tokens, 3)];
    for (const phrase of phrases) {
      if (existing.has(phrase)) continue;
      let cluster = map.get(phrase);
      if (!cluster) {
        cluster = {
          phrase,
          count: 0,
          sources: new Set(),
          evidence: [],
        };
        map.set(phrase, cluster);
      }
      cluster.count++;
      if (item.source) cluster.sources.add(item.source);
      if (cluster.evidence.length < EVIDENCE_PER_PROPOSAL) {
        cluster.evidence.push(item);
      }
    }
  }
  return [...map.values()]
    .filter(
      (c) =>
        c.count >= MIN_OCCURRENCES &&
        c.sources.size >= MIN_DISTINCT_SOURCES,
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_PROPOSALS_PER_RUN);
}

function inferSentimentForCluster(
  cluster: PhraseCluster,
  narratives: ActiveNarrative[],
): NarrativeStance {
  if (narratives.length === 0) return "neutral";
  // Feed a representative evidence headline through matchNarratives
  const sample = cluster.evidence[0];
  if (!sample?.headline) return "neutral";
  const parsed: ParsedHeadline = {
    raw: sample.headline,
    source: (sample.source as NewsSource) || "Custom",
    symbols: sample.symbols ?? [],
    isBreaking: false,
    urgency: "normal",
    tags: sample.tags ?? [],
    confidence: 0.5,
    speaker: "lexicon-proposer", // synthetic — forces narrative path
  };
  const matched = matchNarratives(parsed, narratives);
  if (matched.length === 0) return "neutral";
  let bull = 0;
  let bear = 0;
  for (const n of matched) {
    if (n.stance === "bullish") bull++;
    else if (n.stance === "bearish") bear++;
  }
  if (bull > 0 && bear === 0) return "bullish";
  if (bear > 0 && bull === 0) return "bearish";
  return "neutral";
}

export interface LexiconProposalRow {
  phrase: string;
  inferred_sentiment: NarrativeStance;
  occurrences: number;
  distinct_sources: number;
  evidence_ids: string[];
  evidence_headlines: string[];
  status: "pending";
  proposed_by: "lexicon-proposer";
}

async function insertProposals(
  rows: LexiconProposalRow[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const sb = getSupabaseClient();
  if (!sb) return 0;
  try {
    const { error } = await sb.from("lexicon_proposals").insert(rows);
    if (error) {
      dlog(`insertProposals soft-fail: ${error.message}`);
      return 0;
    }
    return rows.length;
  } catch (err) {
    dlog(`insertProposals threw: ${String(err)}`);
    return 0;
  }
}

async function fireDigestPush(count: number): Promise<void> {
  if (count === 0) return;
  try {
    const { emitPushAndLog } = await import("../notifications/emit.js");
    await emitPushAndLog({
      userId: "all",
      category: "lexiconProposals",
      severity: "medium",
      title: "Lexicon proposals",
      body: `${count} new phrase${count === 1 ? "" : "s"} awaiting review`,
      url: "/admin/lexicon",
      fingerprint: `lexicon-digest-${new Date().toISOString().slice(0, 13)}`,
    });
  } catch (err) {
    dlog(`fireDigestPush soft-fail: ${String(err)}`);
  }
}

export interface ProposeLexiconResult {
  scanned: number;
  clusters: number;
  proposed: number;
}

/**
 * Scan 24h of geopolitical/commentator items, cluster repeated phrases not in
 * the existing lexicon, and write one row per cluster into lexicon_proposals.
 * Returns a summary; does not throw.
 */
export async function proposeLexiconUpdates(): Promise<ProposeLexiconResult> {
  const items = await fetchRecentGeoCommentaryItems();
  if (items.length === 0) {
    return { scanned: 0, clusters: 0, proposed: 0 };
  }

  const [existing, narratives] = await Promise.all([
    fetchExistingLexicon(),
    fetchActiveNarratives(),
  ]);

  const clusters = clusterPhrases(items, existing);
  if (clusters.length === 0) {
    return { scanned: items.length, clusters: 0, proposed: 0 };
  }

  const rows: LexiconProposalRow[] = clusters.map((c) => ({
    phrase: c.phrase,
    inferred_sentiment: inferSentimentForCluster(c, narratives),
    occurrences: c.count,
    distinct_sources: c.sources.size,
    evidence_ids: c.evidence.map((e) => e.tweet_id),
    evidence_headlines: c.evidence
      .map((e) => e.headline ?? "")
      .filter(Boolean),
    status: "pending",
    proposed_by: "lexicon-proposer",
  }));

  const proposed = await insertProposals(rows);
  await fireDigestPush(proposed);

  log.info(
    `proposeLexiconUpdates: scanned=${items.length} clusters=${clusters.length} proposed=${proposed}`,
  );
  return {
    scanned: items.length,
    clusters: clusters.length,
    proposed,
  };
}

export const __test = {
  normalize,
  ngrams,
  clusterPhrases,
  inferSentimentForCluster,
};
