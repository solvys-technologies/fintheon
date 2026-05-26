import { getSupabaseClient } from "../../config/supabase.js";
import type { SensemakingCatalyst } from "./types.js";

interface CatalystRow {
  tweet_id: string;
  headline: string | null;
  body: string | null;
  source: string | null;
  symbols: string[] | null;
  tags: string[] | null;
  sentiment: string | null;
  iv_score: number | null;
  published_at: string | null;
  promoted_at: string | null;
  category: string | null;
  market_impact: string | null;
  agent_note: string | null;
}

const SELECT_FIELDS =
  "tweet_id, headline, body, source, symbols, tags, sentiment, iv_score, published_at, promoted_at, category, market_impact, agent_note";

export function normalizeCatalystId(id: string): string {
  return id.replace(/^(rf-)?backend-/, "");
}

export async function readSensemakingCatalysts(ids: string[], query = "") {
  const sb = getSupabaseClient();
  if (!sb) return { anchors: [], pool: [], links: new Map<string, string[]>() };

  const anchorIds = Array.from(new Set(ids.map(normalizeCatalystId)));
  let anchorRows: CatalystRow[] = [];

  if (anchorIds.length > 0) {
    const { data: anchorsData, error: anchorsError } = await sb
      .from("scored_riskflow_items")
      .select(SELECT_FIELDS)
      .in("tweet_id", anchorIds);

    if (anchorsError) {
      console.warn("[NarrativeSensemaking] anchor read failed", anchorsError);
      return { anchors: [], pool: [], links: new Map<string, string[]>() };
    }
    anchorRows = (anchorsData ?? []) as CatalystRow[];
  }

  const windowRange = getWindowRange(anchorRows);
  let poolQuery = sb
    .from("scored_riskflow_items")
    .select(SELECT_FIELDS)
    .order("published_at", { ascending: false })
    .limit(500);

  if (windowRange) {
    poolQuery = poolQuery
      .gte("published_at", windowRange.start)
      .lte("published_at", windowRange.end);
  }

  const { data: poolData, error: poolError } = await poolQuery;
  if (poolError) {
    console.warn("[NarrativeSensemaking] related pool read failed", poolError);
  }

  let poolRows = (poolData ?? []) as CatalystRow[];
  if (anchorRows.length === 0) {
    anchorRows = selectRelevantAnchors(poolRows, query);
    const selectedIds = new Set(anchorRows.map((row) => row.tweet_id));
    poolRows = poolRows.filter((row) => !selectedIds.has(row.tweet_id));
  }
  const allIds = Array.from(
    new Set(
      [...anchorRows, ...poolRows].map((row) => row.tweet_id).filter(Boolean),
    ),
  );
  const links = await readNarrativeLinks(allIds);

  return {
    anchors: anchorRows.map((row) => toCatalyst(row, links, "anchor")),
    pool: poolRows.map((row) => toCatalyst(row, links, "related")),
    links,
  };
}

async function readNarrativeLinks(
  ids: string[],
): Promise<Map<string, string[]>> {
  const sb = getSupabaseClient();
  const links = new Map<string, string[]>();
  if (!sb || ids.length === 0) return links;

  const { data, error } = await sb
    .from("narrative_card_links")
    .select("card_id, thread_slug")
    .in("card_id", ids);

  if (error) {
    console.warn("[NarrativeSensemaking] narrative link read failed", error);
    return links;
  }

  for (const row of data ?? []) {
    const next = links.get(row.card_id) ?? [];
    next.push(row.thread_slug);
    links.set(row.card_id, next);
  }
  return links;
}

function toCatalyst(
  row: CatalystRow,
  links: Map<string, string[]>,
  role: "anchor" | "related",
): SensemakingCatalyst {
  return {
    id: row.tweet_id,
    headline: row.headline ?? "Untitled catalyst",
    summary: row.body ?? row.agent_note ?? "",
    source: row.source ?? "riskflow",
    category: row.category ?? "macroeconomic",
    sentiment: row.sentiment ?? "neutral",
    ivScore: row.iv_score ?? 0,
    publishedAt: row.published_at ?? new Date().toISOString(),
    promotedAt: row.promoted_at ?? null,
    symbols: row.symbols ?? [],
    tags: row.tags ?? [],
    narrativeThreads: links.get(row.tweet_id) ?? [],
    marketImpact: row.market_impact ?? null,
    agentNote: row.agent_note ?? null,
    role,
    relationScore: role === "anchor" ? 100 : 0,
    relationReason:
      role === "anchor" ? "Attached headline" : "Related catalyst",
  };
}

function selectRelevantAnchors(rows: CatalystRow[], query: string) {
  if (rows.length === 0) return [];
  const terms = searchTerms(query);
  const scored = rows.map((row) => ({
    row,
    score: scoreCatalystRow(row, terms),
  }));
  const ranked = scored
    .filter((item) => item.score > 0 || terms.length === 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ivDelta = (b.row.iv_score ?? 0) - (a.row.iv_score ?? 0);
      if (ivDelta !== 0) return ivDelta;
      return (
        new Date(b.row.published_at ?? 0).getTime() -
        new Date(a.row.published_at ?? 0).getTime()
      );
    });
  return ranked.slice(0, 3).map((item) => item.row);
}

function scoreCatalystRow(row: CatalystRow, terms: string[]): number {
  const text = [
    row.headline,
    row.body,
    row.source,
    ...(row.symbols ?? []),
    ...(row.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();
  const termScore = terms.reduce(
    (score, term) => score + (text.includes(term) ? 12 : 0),
    0,
  );
  return termScore + Math.min(row.iv_score ?? 0, 10);
}

function searchTerms(query: string): string[] {
  const stopwords = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "what",
    "when",
    "where",
    "narrative",
    "impact",
    "probability",
  ]);
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 2 && !stopwords.has(term)),
    ),
  ).slice(0, 12);
}

function getWindowRange(rows: CatalystRow[]) {
  const times = rows
    .map((row) => new Date(row.published_at ?? "").getTime())
    .filter(Number.isFinite);
  if (times.length === 0) return null;

  const start = new Date(Math.min(...times));
  start.setDate(start.getDate() - 7);
  const end = new Date(Math.max(...times));
  end.setDate(end.getDate() + 7);
  return { start: start.toISOString(), end: end.toISOString() };
}
