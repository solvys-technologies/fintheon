// [claude-code 2026-03-20] Supabase cloud service — full data layer replacing Notion + scoring, ER, settings, consilium
// [claude-code 2026-03-19] Supabase cloud service — centralized scoring, ER persistence, user settings, consilium
// [claude-code 2026-04-24] S34-T3: extended EconEventRecord with country/category/event_key; added upsertEconEvent + readUpcomingEconEvents for the calendar populator + /api/econ/upcoming.
// [claude-code 2026-04-26] S46.1: writeRawItems now applies the publisher-blocklist
// (Bloomberg/Reuters/CNBC/Fox/MSNBC/CNN/etc) to every ingest path uniformly.
// [claude-code 2026-04-29] S53-T4B: source-policy enforcement at writeRawItems boundary —
// only approved X handles and official .gov domains may enter the feed. Everything else
// is blocked here with ledger recording.
import { getSupabaseClient, isSupabaseConfigured } from "../config/supabase.js";
import { sql as dbSql, isDatabaseAvailable } from "../config/database.js";
import { filterBlockedPublishers } from "./riskflow/publisher-blocklist.js";
import { checkSourcePolicy } from "./riskflow/source-policy.js";
import { recordIngestAttempt, recordLeakEvent } from "./riskflow/ingest-ledger.js";

// ─── Types ──────────────────────────────────────────────────────

export interface MarketImpactData {
  nq: { points: number; percent: number } | null;
  es: { points: number; percent: number } | null;
  ym: { points: number; percent: number } | null;
  asOf: string;
}

export interface RawRiskFlowItem {
  tweet_id: string;
  source?: string;
  headline?: string;
  body?: string;
  url?: string;
  image_url?: string | null;
  /** [claude-code 2026-04-27] S46.4/I: direct .mp4 attached to a tweet. */
  video_url?: string | null;
  symbols?: string[];
  tags?: string[];
  is_breaking?: boolean;
  urgency?: string;
  published_at?: string;
  submitted_by?: string;
  /** S48-T1: which ingest pipeline produced this item */
  ingest_pipeline?: string;
}

export interface ScoredRiskFlowItem extends RawRiskFlowItem {
  raw_item_id?: string;
  sentiment?: string;
  iv_score?: number;
  macro_level?: number;
  analyzed_at?: string;
  scored_by?: string;
  price_brain_score?: Record<string, unknown>;
  sub_scores?: Record<string, unknown>;
  risk_type?: string;
  agent_note?: string;
  agent_note_generated_at?: string;
  econ_data?: Record<string, unknown>;
  market_impact?: MarketImpactData | null;
  instrument_scores?: Record<
    string,
    { sentiment: string; impliedPoints: number }
  >;
}

export interface ERScoreRecord {
  user_id: string;
  final_score?: number;
  time_in_tilt_seconds?: number;
  infraction_count?: number;
  session_duration_seconds?: number;
  is_finalized?: boolean;
}

export interface UserSettingsRecord {
  user_id: string;
  selected_symbol?: string;
  risk_settings?: Record<string, unknown>;
  watchlist?: unknown[];
}

export interface ConsiliumMessageRecord {
  agent_name: string;
  agent_role?: string;
  content: string;
  message_type?: string;
  metadata?: Record<string, unknown>;
}

// ─── Raw Items (all instances push) ─────────────────────────────

export async function writeRawItems(items: RawRiskFlowItem[]): Promise<number> {
  if (items.length === 0) return 0;

  // [claude-code 2026-04-26] S46.1: drop blocked-publisher items at the persist
  // boundary so every ingest path (Rettiwt, Agent-Reach, Exa, browser) inherits
  // the same filter without per-poller plumbing.
  const filtered = filterBlockedPublishers(items);
  if (filtered.dropped.length > 0) {
    console.log(
      `[Supabase] publisher-blocklist dropped ${filtered.dropped.length}/${items.length} item(s):`,
      filtered.dropped.slice(0, 5).map((d) => ({
        host: d.item.url ? new URL(d.item.url).hostname : "(no url)",
        reason: d.reason.reason,
        detail: d.reason.detail,
        headline: (d.item.headline ?? "").slice(0, 80),
      })),
    );
  }
  items = filtered.kept;
  if (items.length === 0) return 0;

  // [claude-code 2026-04-29] S53-T4B: source-policy enforcement — deny by default.
  // Only approved X handles and official .gov domains pass.
  const policyPassed: RawRiskFlowItem[] = [];
  for (const item of items) {
    const verdict = checkSourcePolicy(item.source, item.url);
    if (verdict.decision === "allowed") {
      policyPassed.push(item);
      recordIngestAttempt({
        source: item.source,
        pipeline: item.ingest_pipeline ?? "unknown",
        decision: "accepted",
        reason: verdict.reason,
        headlinePreview: item.headline?.slice(0, 80),
      });
    } else {
      recordIngestAttempt({
        source: item.source,
        pipeline: item.ingest_pipeline ?? "unknown",
        decision: "blocked_by_policy",
        reason: verdict.reason,
        headlinePreview: item.headline?.slice(0, 80),
      });
      recordLeakEvent(`${verdict.decision}: ${item.source} — ${item.headline?.slice(0, 60) ?? "(no headline)"}`);
    }
  }
  if (policyPassed.length < items.length) {
    console.log(
      `[SourcePolicy] blocked ${items.length - policyPassed.length}/${items.length} item(s) — ` +
      `sources not in allowlist`,
    );
  }
  items = policyPassed;
  if (items.length === 0) return 0;

  // [claude-code 2026-04-06] Primary: raw SQL (Supabase JS upsert silently fails)
  if (isDatabaseAvailable() && dbSql) {
    try {
      let written = 0;
      for (const item of items) {
        const result = await dbSql`
          INSERT INTO raw_riskflow_items (
            tweet_id, source, headline, body, url, image_url, video_url, symbols, tags,
            is_breaking, urgency, published_at, submitted_by, ingest_pipeline
          ) VALUES (
            ${item.tweet_id}, ${item.source}, ${item.headline},
            ${item.body ?? null}, ${item.url ?? null}, ${item.image_url ?? null},
            ${item.video_url ?? null},
            ${item.symbols ?? []}, ${item.tags ?? []},
            ${item.is_breaking ?? false}, ${item.urgency ?? "normal"},
            ${item.published_at ?? new Date().toISOString()}, ${item.submitted_by ?? "unknown"},
            ${item.ingest_pipeline ?? null}
          ) ON CONFLICT (tweet_id) DO NOTHING
        `;
        written++;
      }
      return written;
    } catch (err) {
      console.error(
        "[Supabase] writeRawItems SQL error:",
        (err as Error).message,
      );
    }
  }

  // Fallback: Supabase JS client
  const sb = getSupabaseClient();
  if (!sb) return 0;

  const { data, error } = await sb
    .from("raw_riskflow_items")
    .upsert(items, { onConflict: "tweet_id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    console.error("[Supabase] writeRawItems client error:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

// [claude-code 2026-04-12] Auto-delete raw_riskflow_items older than 7 days.
// Raw items only exist as an inbox for the central scorer. Once scored, they're
// redundant — scored_riskflow_items is the permanent record.
export async function cleanupOldRawItems(maxAgeDays = 7): Promise<number> {
  const cutoff = new Date(
    Date.now() - maxAgeDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  if (isDatabaseAvailable() && dbSql) {
    try {
      const result = await dbSql`
        DELETE FROM raw_riskflow_items
        WHERE created_at < ${cutoff}
      `;
      return (result as any).count ?? result.length;
    } catch (err) {
      console.error(
        "[Supabase] cleanupOldRawItems SQL error:",
        (err as Error).message,
      );
      return 0;
    }
  }

  const sb = getSupabaseClient();
  if (!sb) return 0;

  const { count, error } = await sb
    .from("raw_riskflow_items")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  if (error) {
    console.error("[Supabase] cleanupOldRawItems client error:", error.message);
    return 0;
  }
  return count ?? 0;
}

// [claude-code 2026-04-01] Permanent fix: use raw SQL (pg Pool) for unscored item detection.
// Supabase JS client .not('in', subquery) silently returns empty — never use it.
// The two-query JS fallback also fails when unscored items are scattered across thousands of rows.
// Raw SQL NOT EXISTS is the only reliable approach.
export async function readUnscoredItems(
  limit = 50,
): Promise<(RawRiskFlowItem & { id: string })[]> {
  // Primary: use the pg Pool SQL driver (same one boardroom-store uses)
  if (isDatabaseAvailable() && dbSql) {
    try {
      const rows = await dbSql`
        SELECT r.*
        FROM raw_riskflow_items r
        WHERE NOT EXISTS (
          SELECT 1 FROM scored_riskflow_items s WHERE s.tweet_id = r.tweet_id
        )
        ORDER BY r.created_at ASC
        LIMIT ${limit}
      `;
      return rows as (RawRiskFlowItem & { id: string })[];
    } catch (err) {
      console.error(
        "[Supabase] readUnscoredItems SQL failed, trying Supabase client fallback:",
        (err as Error).message,
      );
    }
  }

  // Fallback: two-query approach via Supabase JS client
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data: rawItems } = await sb
    .from("raw_riskflow_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit * 5);

  if (!rawItems?.length) return [];

  const tweetIds = rawItems.map((r) => r.tweet_id);
  const { data: scoredItems } = await sb
    .from("scored_riskflow_items")
    .select("tweet_id")
    .in("tweet_id", tweetIds);

  const scoredSet = new Set((scoredItems ?? []).map((s) => s.tweet_id));
  return rawItems.filter((r) => !scoredSet.has(r.tweet_id)).slice(0, limit);
}

// ─── Scored Items (central agent writes, all read) ──────────────

export async function writeScoredItems(
  items: ScoredRiskFlowItem[],
): Promise<number> {
  if (items.length === 0) return 0;

  // [claude-code 2026-04-06] Primary: raw SQL (Supabase JS upsert was silently failing)
  if (isDatabaseAvailable() && dbSql) {
    try {
      let written = 0;
      for (const item of items) {
        await dbSql`
          INSERT INTO scored_riskflow_items (
            raw_item_id, tweet_id, source, headline, body, url, image_url, video_url, symbols, tags,
            is_breaking, urgency, sentiment, iv_score, macro_level,
            published_at, analyzed_at, scored_by, price_brain_score,
            sub_scores, risk_type, agent_note, agent_note_generated_at, econ_data
          ) VALUES (
            ${item.raw_item_id ?? null}, ${item.tweet_id}, ${item.source}, ${item.headline},
            ${item.body ?? null}, ${item.url ?? null}, ${item.image_url ?? null},
            ${item.video_url ?? null},
            ${item.symbols ?? []}, ${item.tags ?? []},
            ${item.is_breaking ?? false}, ${item.urgency ?? "normal"}, ${item.sentiment ?? null},
            ${item.iv_score ?? null}, ${item.macro_level ?? null},
            ${item.published_at ?? new Date().toISOString()}, ${item.analyzed_at ?? new Date().toISOString()},
            ${item.scored_by ?? "central-agent"}, ${item.price_brain_score ? JSON.stringify(item.price_brain_score) : null}::jsonb,
            ${item.sub_scores ? JSON.stringify(item.sub_scores) : null}::jsonb, ${item.risk_type ?? null},
            ${item.agent_note ?? null}, ${item.agent_note_generated_at ?? null},
            ${item.econ_data ? JSON.stringify(item.econ_data) : null}::jsonb
          ) ON CONFLICT (tweet_id) DO UPDATE SET
            sentiment = EXCLUDED.sentiment,
            iv_score = EXCLUDED.iv_score,
            macro_level = EXCLUDED.macro_level,
            analyzed_at = EXCLUDED.analyzed_at,
            price_brain_score = EXCLUDED.price_brain_score,
            sub_scores = EXCLUDED.sub_scores,
            risk_type = EXCLUDED.risk_type,
            agent_note = EXCLUDED.agent_note,
            agent_note_generated_at = EXCLUDED.agent_note_generated_at,
            econ_data = EXCLUDED.econ_data,
            url = COALESCE(scored_riskflow_items.url, EXCLUDED.url),
            image_url = COALESCE(scored_riskflow_items.image_url, EXCLUDED.image_url),
            video_url = COALESCE(scored_riskflow_items.video_url, EXCLUDED.video_url)
        `;
        written++;
      }
      return written;
    } catch (err) {
      console.error(
        "[Supabase] writeScoredItems SQL error:",
        (err as Error).message,
        (err as Error).stack?.slice(0, 300),
      );
      // Log the failing item for debugging
      console.error(
        "[Supabase] Failed item sample:",
        JSON.stringify(items[0]?.tweet_id),
        "raw_item_id:",
        items[0]?.raw_item_id,
      );
    }
  }

  // Fallback: Supabase JS client
  const sb = getSupabaseClient();
  if (!sb) return 0;

  const { data, error } = await sb
    .from("scored_riskflow_items")
    .upsert(items, { onConflict: "tweet_id", ignoreDuplicates: false })
    .select("id");

  if (error) {
    console.error("[Supabase] writeScoredItems client error:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

export async function readScoredItems(options?: {
  minMacroLevel?: number;
  limit?: number;
  since?: string;
}): Promise<ScoredRiskFlowItem[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  let query = sb
    .from("scored_riskflow_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 100);

  if (options?.minMacroLevel) {
    query = query.gte("macro_level", options.minMacroLevel);
  }
  if (options?.since) {
    query = query.gte("created_at", options.since);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Supabase] readScoredItems error:", error.message);
    return [];
  }
  return data ?? [];
}

// ─── Market Impact (daily close enrichment for scored items) ────

/**
 * Read scored items that need market impact enrichment:
 * macro_level >= 3, no market_impact, older than 24h.
 */
export async function readItemsNeedingMarketImpact(
  limit = 50,
): Promise<ScoredRiskFlowItem[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from("scored_riskflow_items")
    .select("*")
    .gte("macro_level", 3)
    .is("market_impact", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(
      "[Supabase] readItemsNeedingMarketImpact error:",
      error.message,
    );
    return [];
  }
  return data ?? [];
}

/**
 * Write market_impact JSONB to scored items by tweet_id.
 */
export async function writeMarketImpact(
  updates: Array<{ tweet_id: string; market_impact: MarketImpactData }>,
): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb || updates.length === 0) return 0;

  let written = 0;
  for (const { tweet_id, market_impact } of updates) {
    const { error } = await sb
      .from("scored_riskflow_items")
      .update({ market_impact })
      .eq("tweet_id", tweet_id);

    if (error) {
      console.error("[Supabase] writeMarketImpact error:", error.message, {
        tweet_id,
      });
    } else {
      written++;
    }
  }
  return written;
}

/**
 * S9-T2b: Batch-write per-instrument sentiment scores into the instrument_scores JSONB column.
 * Merges new instrument data with existing JSONB using Postgres || operator.
 * Called fire-and-forget from the feed handler — never blocks the response.
 */
export async function writeInstrumentScores(
  updates: Array<{
    tweet_id: string;
    instrument: string;
    sentiment: string;
    impliedPoints: number;
  }>,
): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb || updates.length === 0) return 0;

  let written = 0;
  // Batch by tweet_id in case multiple instruments per item (future-proofing)
  const grouped = new Map<
    string,
    Record<string, { sentiment: string; impliedPoints: number }>
  >();
  for (const { tweet_id, instrument, sentiment, impliedPoints } of updates) {
    if (!grouped.has(tweet_id)) grouped.set(tweet_id, {});
    grouped.get(tweet_id)![instrument] = { sentiment, impliedPoints };
  }

  for (const [tweet_id, scores] of grouped) {
    // Use RPC or raw update to merge JSONB — Supabase JS doesn't natively support || merge,
    // so we read-merge-write. For fire-and-forget this is acceptable.
    const { data: existing } = await sb
      .from("scored_riskflow_items")
      .select("instrument_scores")
      .eq("tweet_id", tweet_id)
      .single();

    const merged = { ...(existing?.instrument_scores ?? {}), ...scores };
    const { error } = await sb
      .from("scored_riskflow_items")
      .update({ instrument_scores: merged })
      .eq("tweet_id", tweet_id);

    if (error) {
      console.error("[Supabase] writeInstrumentScores error:", error.message, {
        tweet_id,
      });
    } else {
      written++;
    }
  }
  return written;
}

// ─── ER Scores ──────────────────────────────────────────────────

export async function writeERSession(record: ERScoreRecord): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb.from("er_scores").insert(record);
  if (error) {
    console.error("[Supabase] writeERSession error:", error.message);
    return false;
  }
  return true;
}

export async function readERSessions(
  userId: string,
  limit = 20,
): Promise<ERScoreRecord[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from("er_scores")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Supabase] readERSessions error:", error.message);
    return [];
  }
  return data ?? [];
}

// ─── User Settings ──────────────────────────────────────────────

export async function writeUserSettings(
  record: UserSettingsRecord,
): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb
    .from("user_settings")
    .upsert(
      { ...record, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error("[Supabase] writeUserSettings error:", error.message);
    return false;
  }
  return true;
}

export async function readUserSettings(
  userId: string,
): Promise<UserSettingsRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      // not found is ok
      console.error("[Supabase] readUserSettings error:", error.message);
    }
    return null;
  }
  return data;
}

// ─── Consilium Messages ─────────────────────────────────────────

export async function writeConsiliumMessage(
  record: ConsiliumMessageRecord,
): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb.from("consilium_messages").insert(record);
  if (error) {
    console.error("[Supabase] writeConsiliumMessage error:", error.message);
    return false;
  }
  return true;
}

export async function readConsiliumMessages(
  limit = 100,
): Promise<ConsiliumMessageRecord[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from("consilium_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[Supabase] readConsiliumMessages error:", error.message);
    return [];
  }
  return data ?? [];
}

// ─── Trade Ideas ────────────────────────────────────────────────

export interface TradeIdeaRecord {
  id?: string;
  title: string;
  ticker?: string;
  direction?: "Long" | "Short";
  entry_price?: number;
  stop_loss?: number;
  take_profit?: number;
  confidence?: number;
  analyst?: string;
  thesis?: string;
  status?: string;
  model?: string;
  timeframe?: string;
  risk_reward_ratio?: number;
  hermes_description?: string;
  pnl?: number;
  created_at?: string;
  updated_at?: string;
}

export async function writeTradeIdea(
  idea: Omit<TradeIdeaRecord, "id" | "created_at" | "updated_at">,
): Promise<TradeIdeaRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("trade_ideas")
    .insert(idea)
    .select()
    .single();

  if (error) {
    console.error("[Supabase] writeTradeIdea error:", error.message);
    return null;
  }
  return data;
}

export async function readTradeIdeas(filter?: {
  status?: string;
  limit?: number;
}): Promise<TradeIdeaRecord[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  let query = sb
    .from("trade_ideas")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filter?.limit ?? 100);

  if (filter?.status) {
    query = query.eq("status", filter.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Supabase] readTradeIdeas error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function updateTradeIdeaStatus(
  id: string,
  status: string,
): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb
    .from("trade_ideas")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[Supabase] updateTradeIdeaStatus error:", error.message);
    return false;
  }
  return true;
}

// ─── Daily P&L ──────────────────────────────────────────────────

export interface DailyPnlRecord {
  id?: string;
  day_label: string;
  date: string;
  net_pnl?: number;
  gross_pnl?: number;
  win_rate?: number;
  trades_taken?: number;
  bias?: string;
  ntn_summary?: string;
  fees?: number;
  created_at?: string;
}

export async function writeDailyPnl(
  record: Omit<DailyPnlRecord, "id" | "created_at">,
): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb
    .from("daily_pnl")
    .upsert(record, { onConflict: "date" });

  if (error) {
    console.error("[Supabase] writeDailyPnl error:", error.message);
    return false;
  }
  return true;
}

export async function readDailyPnl(filter?: {
  limit?: number;
  from?: string;
  to?: string;
}): Promise<DailyPnlRecord[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  let query = sb
    .from("daily_pnl")
    .select("*")
    .order("date", { ascending: false })
    .limit(filter?.limit ?? 30);

  if (filter?.from) query = query.gte("date", filter.from);
  if (filter?.to) query = query.lte("date", filter.to);

  const { data, error } = await query;
  if (error) {
    console.error("[Supabase] readDailyPnl error:", error.message);
    return [];
  }
  return data ?? [];
}

// ─── Briefs ─────────────────────────────────────────────────────

export type BriefType = "MDB" | "ADB" | "PMDB" | "TWT";

export interface BriefRecord {
  id?: string;
  brief_type: BriefType;
  content: string;
  generated_by?: string;
  status?: string;
  category?: string;
  created_at?: string;
}

export async function writeBrief(
  brief: Omit<BriefRecord, "id" | "created_at">,
): Promise<BriefRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  // Archive previous active briefs of same type
  await sb
    .from("briefs")
    .update({ status: "Archived" })
    .eq("brief_type", brief.brief_type)
    .eq("status", "Active");

  const { data, error } = await sb
    .from("briefs")
    .insert({ ...brief, status: brief.status ?? "Active" })
    .select()
    .single();

  if (error) {
    console.error("[Supabase] writeBrief error:", error.message);
    return null;
  }
  return data;
}

export async function readBriefs(
  type?: BriefType,
  limit = 10,
): Promise<BriefRecord[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  let query = sb
    .from("briefs")
    .select("*")
    .eq("status", "Active")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (type) query = query.eq("brief_type", type);

  const { data, error } = await query;
  if (error) {
    console.error("[Supabase] readBriefs error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function readLatestBrief(
  type: BriefType,
): Promise<BriefRecord | null> {
  const briefs = await readBriefs(type, 1);
  return briefs[0] ?? null;
}

// ─── Economic Events ────────────────────────────────────────────

export interface EconEventRecord {
  id?: string;
  name: string;
  date?: string;
  time?: string;
  forecast?: string;
  actual?: string;
  previous?: string;
  detail?: string;
  impact?: "low" | "medium" | "high";
  country?: string;
  category?: string;
  event_key?: string;
  created_at?: string;
  updated_at?: string;
}

export async function writeEconEvent(
  event: Omit<EconEventRecord, "id" | "created_at" | "updated_at">,
): Promise<EconEventRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("economic_events")
    .insert(event)
    .select()
    .single();

  if (error) {
    console.error("[Supabase] writeEconEvent error:", error.message);
    return null;
  }
  return data;
}

// [claude-code 2026-04-24] S34-T3: idempotent upsert on event_key for the populator.
export async function upsertEconEvent(
  event: Omit<EconEventRecord, "id" | "created_at" | "updated_at"> & {
    event_key: string;
  },
): Promise<EconEventRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("economic_events")
    .upsert(
      { ...event, updated_at: new Date().toISOString() },
      { onConflict: "event_key" },
    )
    .select()
    .single();

  if (error) {
    console.error("[Supabase] upsertEconEvent error:", error.message);
    return null;
  }
  return data;
}

// [claude-code 2026-04-24] S34-T3: filter-aware upcoming read for /api/econ/upcoming.
export async function readUpcomingEconEvents(filter: {
  country?: string;
  category?: string;
  daysAhead?: number;
}): Promise<EconEventRecord[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setUTCDate(horizon.getUTCDate() + (filter.daysAhead ?? 7));
  const to = horizon.toISOString().slice(0, 10);

  let query = sb
    .from("economic_events")
    .select("*")
    .gte("date", today)
    .lte("date", to)
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(500);

  if (filter.country) query = query.eq("country", filter.country);
  if (filter.category) query = query.eq("category", filter.category);

  const { data, error } = await query;
  if (error) {
    console.error("[Supabase] readUpcomingEconEvents error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function readEconEvents(dateRange?: {
  from?: string;
  to?: string;
}): Promise<EconEventRecord[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  let query = sb
    .from("economic_events")
    .select("*")
    .order("date", { ascending: true })
    .limit(100);

  if (dateRange?.from) query = query.gte("date", dateRange.from);
  if (dateRange?.to) query = query.lte("date", dateRange.to);

  const { data, error } = await query;
  if (error) {
    console.error("[Supabase] readEconEvents error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function updateEconEventActual(
  id: string,
  actual: string,
): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb
    .from("economic_events")
    .update({ actual, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[Supabase] updateEconEventActual error:", error.message);
    return false;
  }
  return true;
}

// ─── Econ Prints ────────────────────────────────────────────────

export interface EconPrintRecord {
  id?: string;
  event_id?: string;
  headline: string;
  actual_value?: string;
  forecast_value?: string;
  previous_value?: string;
  iv_score?: number;
  source?: string;
  printed_at?: string;
}

export async function writeEconPrint(
  print: Omit<EconPrintRecord, "id" | "printed_at">,
): Promise<EconPrintRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("econ_prints")
    .insert(print)
    .select()
    .single();

  if (error) {
    console.error("[Supabase] writeEconPrint error:", error.message);
    return null;
  }
  return data;
}

export async function readEconPrints(filter?: {
  eventName?: string;
  limit?: number;
}): Promise<EconPrintRecord[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  let query = sb
    .from("econ_prints")
    .select("*")
    .order("printed_at", { ascending: false })
    .limit(filter?.limit ?? 50);

  if (filter?.eventName) {
    query = query.ilike("headline", `%${filter.eventName}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Supabase] readEconPrints error:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Fetch historical econ prints + related scored items for a specific ticker.
 * Used by Sanctum expanded cards to show print history with scoring breakdown.
 */
// Keyword patterns per econ ticker — used to find relevant FJ tweets in scored items
const ECON_KEYWORD_MAP: Record<string, string[]> = {
  CPI: ["cpi", "consumer price"],
  PPI: ["ppi", "producer price"],
  PI: ["personal income"],
  GDP: ["gdp", "gross domestic"],
  PMI: ["pmi", "purchasing managers", "ism manufacturing", "ism services"],
  PCE: ["pce", "personal consumption"],
  FOMC: [
    "fomc",
    "fed rate",
    "federal reserve",
    "powell speaks",
    "fed holds",
    "fed cuts",
    "fed hikes",
  ],
  CUTS: [
    "traders price in",
    "rate cut",
    "basis points",
    "cuts priced",
    "pricing in cuts",
    "rate expectations",
  ],
};

export async function readEconHistory(
  ticker: string,
  limit = 10,
): Promise<{
  prints: EconPrintRecord[];
  scoredItems: ScoredRiskFlowItem[];
}> {
  const sb = getSupabaseClient();
  if (!sb) return { prints: [], scoredItems: [] };

  // Get keyword patterns for this ticker
  const keywords = ECON_KEYWORD_MAP[ticker.toUpperCase()] ?? [
    ticker.toLowerCase(),
  ];

  // Build OR filter: headline.ilike.%keyword1%,headline.ilike.%keyword2%,...
  const orFilter = keywords.map((kw) => `headline.ilike.%${kw}%`).join(",");

  const [printsResult, scoredResult] = await Promise.allSettled([
    sb
      .from("econ_prints")
      .select("*")
      .or(orFilter)
      .order("printed_at", { ascending: false })
      .limit(limit),
    sb
      .from("scored_riskflow_items")
      .select("*")
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(limit * 2),
  ]);

  const prints =
    printsResult.status === "fulfilled" && !printsResult.value.error
      ? (printsResult.value.data ?? [])
      : [];
  const scoredItems =
    scoredResult.status === "fulfilled" && !scoredResult.value.error
      ? (scoredResult.value.data ?? [])
      : [];

  return { prints, scoredItems };
}

/**
 * Fetch aggregated econ print stats for AgentDesk context enrichment.
 * Returns recent prints with beat/miss patterns grouped by event type.
 */
export async function readRecentEconPrintStats(
  sinceHours = 168,
): Promise<EconPrintRecord[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const cutoff = new Date(
    Date.now() - sinceHours * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await sb
    .from("econ_prints")
    .select("*")
    .gte("printed_at", cutoff)
    .order("printed_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[Supabase] readRecentEconPrintStats error:", error.message);
    return [];
  }
  return data ?? [];
}

// ─── ER Events (PsychAssist deterministic scoring) ─────────────

export interface EREventRecord {
  user_id: string;
  event_type: string; // 'curse' | 'breathing' | 'decay_reset'
  trigger_text: string | null;
  penalty: number;
  score_before: number;
  score_after: number;
  curse_count: number;
  decay_window_minutes: number | null;
  transcript_snippet: string | null;
}

export async function writeEREvent(record: EREventRecord): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb.from("er_events").insert(record);
  if (error) {
    console.error("[Supabase] writeEREvent error:", error.message);
    return false;
  }
  return true;
}

export async function readEREvents(
  userId: string,
  limit = 50,
): Promise<(EREventRecord & { id: string; created_at: string })[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from("er_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Supabase] readEREvents error:", error.message);
    return [];
  }
  return data ?? [];
}

// ─── User Profiles ─────────────────────────────────────────────

export interface UserProfileRecord {
  id?: string;
  supabase_uid: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  tier?: "free" | "fintheon" | "fintheon_plus" | "fintheon_pro";
  onboarding_complete?: boolean;
  app_state?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export async function getOrCreateProfile(
  supabaseUid: string,
  email?: string,
  displayName?: string,
  avatarUrl?: string,
): Promise<UserProfileRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  // Try to fetch existing profile
  const { data: existing, error: fetchErr } = await sb
    .from("user_profiles")
    .select("*")
    .eq("supabase_uid", supabaseUid)
    .single();

  if (existing) return existing;

  // PGRST116 = not found — create new profile
  if (fetchErr && fetchErr.code !== "PGRST116") {
    console.error(
      "[Supabase] getOrCreateProfile fetch error:",
      fetchErr.message,
    );
    return null;
  }

  const { data: created, error: createErr } = await sb
    .from("user_profiles")
    .insert({
      supabase_uid: supabaseUid,
      email,
      display_name: displayName,
      avatar_url: avatarUrl,
    })
    .select()
    .single();

  if (createErr) {
    console.error(
      "[Supabase] getOrCreateProfile create error:",
      createErr.message,
    );
    return null;
  }
  return created;
}

export async function updateProfile(
  supabaseUid: string,
  fields: Partial<
    Pick<
      UserProfileRecord,
      "email" | "display_name" | "avatar_url" | "tier" | "onboarding_complete"
    >
  >,
): Promise<UserProfileRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("user_profiles")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("supabase_uid", supabaseUid)
    .select()
    .single();

  if (error) {
    console.error("[Supabase] updateProfile error:", error.message);
    return null;
  }
  return data;
}

export async function getAppState(
  supabaseUid: string,
): Promise<Record<string, unknown> | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("user_profiles")
    .select("app_state")
    .eq("supabase_uid", supabaseUid)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("[Supabase] getAppState error:", error.message);
    }
    return null;
  }
  return (data?.app_state as Record<string, unknown>) ?? {};
}

export async function upsertAppState(
  supabaseUid: string,
  state: Record<string, unknown>,
): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb
    .from("user_profiles")
    .update({ app_state: state, updated_at: new Date().toISOString() })
    .eq("supabase_uid", supabaseUid);

  if (error) {
    console.error("[Supabase] upsertAppState error:", error.message);
    return false;
  }
  return true;
}

// ─── Commentator Registry ──────────────────────────────────────

export async function writeCommentator(
  entry: Omit<
    import("../types/commentator.js").CommentatorEntry,
    "id" | "createdAt"
  >,
): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("commentator_registry")
    .insert({
      name: entry.name,
      aliases: entry.aliases,
      tier: entry.tier,
      role: entry.role ?? null,
      institution: entry.institution ?? null,
      weight_multiplier: entry.weightMultiplier,
      rank: entry.rank ?? 999,
      active: entry.active,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[Supabase] writeCommentator error:", error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function readCommentatorRegistry(): Promise<
  import("../types/commentator.js").CommentatorEntry[]
> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from("commentator_registry")
    .select("*")
    .eq("active", true)
    .order("rank", { ascending: true });

  if (error) {
    console.error("[Supabase] readCommentatorRegistry error:", error.message);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    aliases: (row.aliases as string[]) ?? [],
    tier: row.tier as import("../types/commentator.js").CommentatorTier,
    role: (row.role as string) ?? undefined,
    institution: (row.institution as string) ?? undefined,
    weightMultiplier: Number(row.weight_multiplier ?? 1.0),
    rank: Number(row.rank ?? 999),
    active: row.active as boolean,
    createdAt: row.created_at as string,
  }));
}

export async function updateCommentatorEntry(
  id: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  const { error } = await sb
    .from("commentator_registry")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("[Supabase] updateCommentatorEntry error:", error.message);
  }
}

export async function deactivateCommentator(id: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  const { error } = await sb
    .from("commentator_registry")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    console.error("[Supabase] deactivateCommentator error:", error.message);
  }
}

// [claude-code 2026-03-27] Batch reorder + seed for commentator drag-and-drop ranking
export async function reorderCommentators(orderedIds: string[]): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  // Update rank for each commentator based on array position
  await Promise.all(
    orderedIds.map((id, index) =>
      sb
        .from("commentator_registry")
        .update({ rank: index + 1 })
        .eq("id", id),
    ),
  );
}

export async function seedDefaultCommentators(): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb) return 0;

  // Check if registry already has entries
  const existing = await readCommentatorRegistry();
  if (existing.length > 0) return 0;

  const { DEFAULT_COMMENTATORS } = await import("../types/commentator.js");
  let seeded = 0;
  for (const entry of DEFAULT_COMMENTATORS) {
    const id = await writeCommentator(entry);
    if (id) seeded++;
  }
  return seeded;
}

// ─── Market Regimes ────────────────────────────────────────────

export interface MarketRegimeRecord {
  id?: string;
  regime_type: string;
  detected_by: string;
  confidence?: number;
  notes?: string;
  active?: boolean;
  created_at?: string;
}

export async function writeRegimeState(
  record: Omit<MarketRegimeRecord, "id" | "created_at">,
): Promise<MarketRegimeRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("market_regimes")
    .insert({ ...record, active: record.active ?? true })
    .select()
    .single();

  if (error) {
    console.error("[Supabase] writeRegimeState error:", error.message);
    return null;
  }
  return data;
}

export async function readActiveRegime(): Promise<MarketRegimeRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("market_regimes")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("[Supabase] readActiveRegime error:", error.message);
    }
    return null;
  }
  return data;
}

export async function deactivateCurrentRegime(): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  const { error } = await sb
    .from("market_regimes")
    .update({ active: false })
    .eq("active", true);

  if (error) {
    console.error("[Supabase] deactivateCurrentRegime error:", error.message);
  }
}

export async function readRegimeHistory(
  limit = 20,
): Promise<MarketRegimeRecord[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from("market_regimes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Supabase] readRegimeHistory error:", error.message);
    return [];
  }
  return data ?? [];
}

// ─── Scoring Calibration ────────────────────────────────────────

import type {
  CalibrationEntry,
  RefinementAnnotation,
  CalibrationObservation,
} from "../types/calibration.js";

export async function readCalibrationEntries(): Promise<CalibrationEntry[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from("scoring_calibration")
    .select("*")
    .order("event_type", { ascending: true });

  if (error) {
    console.error("[Supabase] readCalibrationEntries error:", error.message);
    return [];
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    eventType: row.event_type as string,
    baseWeight: Number(row.base_weight),
    regimeOverrides: (row.regime_overrides as Record<string, number>) ?? {},
    updatedAt: row.updated_at as string,
    updatedBy: (row.updated_by as string) ?? "system",
  }));
}

export async function upsertCalibrationWeight(
  eventType: string,
  baseWeight: number,
  regimeOverrides?: Record<string, number>,
  updatedBy?: string,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  const { error } = await sb.from("scoring_calibration").upsert(
    {
      event_type: eventType,
      base_weight: baseWeight,
      regime_overrides: regimeOverrides ?? {},
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? "system",
    },
    { onConflict: "event_type" },
  );

  if (error) {
    console.error("[Supabase] upsertCalibrationWeight error:", error.message);
  }
}

// ─── Refinement Annotations ─────────────────────────────────────

export async function writeAnnotation(
  ann: Omit<RefinementAnnotation, "id" | "createdAt">,
): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("refinement_annotations")
    .insert({
      riskflow_item_id: ann.riskflowItemId,
      comment: ann.comment ?? null,
      flaw_tag: ann.flawTag ?? null,
      suggested_score: ann.suggestedScore ?? null,
      created_by: ann.createdBy ?? "tp",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[Supabase] writeAnnotation error:", error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function readAnnotationsForItem(
  itemId: string,
): Promise<RefinementAnnotation[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from("refinement_annotations")
    .select("*")
    .eq("riskflow_item_id", itemId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Supabase] readAnnotationsForItem error:", error.message);
    return [];
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    riskflowItemId: row.riskflow_item_id as string,
    comment: (row.comment as string) ?? undefined,
    flawTag: (row.flaw_tag as RefinementAnnotation["flawTag"]) ?? undefined,
    suggestedScore:
      row.suggested_score != null ? Number(row.suggested_score) : undefined,
    createdAt: row.created_at as string,
    createdBy: (row.created_by as string) ?? "tp",
  }));
}

// ─── Calibration Observations ───────────────────────────────────

export async function writeObservation(
  obs: Omit<CalibrationObservation, "id" | "createdAt">,
): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("calibration_observations")
    .insert({
      headline: obs.headline,
      event_type: obs.eventType ?? null,
      predicted_iv_score: obs.predictedIVScore ?? null,
      actual_points_move: obs.actualPointsMove ?? null,
      instrument: obs.instrument ?? "/ES",
      regime_at_time: obs.regimeAtTime ?? null,
      vix_at_time: obs.vixAtTime ?? null,
      observed_at: obs.observedAt ?? null,
      notes: obs.notes ?? null,
      source: obs.source ?? "manual",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[Supabase] writeObservation error:", error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function readObservations(
  limit = 50,
): Promise<CalibrationObservation[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from("calibration_observations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Supabase] readObservations error:", error.message);
    return [];
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    headline: row.headline as string,
    eventType: (row.event_type as string) ?? undefined,
    predictedIVScore:
      row.predicted_iv_score != null
        ? Number(row.predicted_iv_score)
        : undefined,
    actualPointsMove:
      row.actual_points_move != null
        ? Number(row.actual_points_move)
        : undefined,
    instrument: (row.instrument as string) ?? "/ES",
    regimeAtTime:
      (row.regime_at_time as CalibrationObservation["regimeAtTime"]) ??
      undefined,
    vixAtTime: row.vix_at_time != null ? Number(row.vix_at_time) : undefined,
    observedAt: (row.observed_at as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    source: (row.source as CalibrationObservation["source"]) ?? "manual",
    createdAt: row.created_at as string,
  }));
}

export async function writeObservationsBatch(
  observations: Omit<CalibrationObservation, "id" | "createdAt">[],
): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb || observations.length === 0) return 0;

  const rows = observations.map((obs) => ({
    headline: obs.headline,
    event_type: obs.eventType ?? null,
    predicted_iv_score: obs.predictedIVScore ?? null,
    actual_points_move: obs.actualPointsMove ?? null,
    instrument: obs.instrument ?? "/ES",
    regime_at_time: obs.regimeAtTime ?? null,
    vix_at_time: obs.vixAtTime ?? null,
    observed_at: obs.observedAt ?? null,
    notes: obs.notes ?? null,
    source: obs.source ?? "manual",
  }));

  const { data, error } = await sb
    .from("calibration_observations")
    .insert(rows)
    .select("id");

  if (error) {
    console.error("[Supabase] writeObservationsBatch error:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

// ─── Econ Synthesis Cache ───────────────────────────────────────

export interface EconSynthesisCacheRecord {
  id?: string;
  event_family: string;
  date_range: string;
  selected_event_ids: string[];
  raw_normalized_rows: unknown[];
  synthesis_text: string;
  model: string;
  version: string;
  user_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function readEconSynthesisCache(opts: {
  eventFamily: string;
  dateRange: string;
  version: string;
}): Promise<EconSynthesisCacheRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("econ_synthesis_cache")
    .select("*")
    .eq("event_family", opts.eventFamily)
    .eq("date_range", opts.dateRange)
    .eq("version", opts.version)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[Supabase] readEconSynthesisCache error:", error.message);
    return null;
  }
  return data as EconSynthesisCacheRecord | null;
}

export async function writeEconSynthesisCache(
  record: Omit<EconSynthesisCacheRecord, "id" | "created_at" | "updated_at">,
): Promise<EconSynthesisCacheRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("econ_synthesis_cache")
    .upsert(
      { ...record, updated_at: new Date().toISOString() },
      { onConflict: "event_family,date_range,version" },
    )
    .select()
    .single();
  if (error) {
    console.error("[Supabase] writeEconSynthesisCache error:", error.message);
    return null;
  }
  return data as EconSynthesisCacheRecord | null;
}

// ─── Agent Proposal Outcomes ────────────────────────────────────

export interface AgentProposalOutcomeRecord {
  id?: string;
  proposal_id: string;
  proposal_type: "prediction" | "trade" | "arbitrum";
  agent_name: string;
  agent_role?: string;
  direction: "long" | "short" | "flat";
  instrument: string;
  entry_price?: number;
  exit_price?: number;
  outcome: "win" | "loss" | "push" | "expired" | "pending";
  pnl?: number;
  resolved_at?: string;
  market_close_countdown_minutes?: number;
  rationale?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export async function writeAgentProposalOutcome(
  record: Omit<AgentProposalOutcomeRecord, "id" | "created_at" | "updated_at">,
): Promise<AgentProposalOutcomeRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("agent_proposal_outcomes")
    .upsert(
      { ...record, updated_at: new Date().toISOString() },
      { onConflict: "proposal_id,proposal_type,agent_name" },
    )
    .select()
    .single();
  if (error) {
    console.error("[Supabase] writeAgentProposalOutcome error:", error.message);
    return null;
  }
  return data as AgentProposalOutcomeRecord | null;
}

export async function readAgentProposalOutcomes(filter?: {
  agentName?: string;
  outcome?: string;
  limit?: number;
}): Promise<AgentProposalOutcomeRecord[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  let query = sb
    .from("agent_proposal_outcomes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filter?.limit ?? 100);
  if (filter?.agentName) query = query.eq("agent_name", filter.agentName);
  if (filter?.outcome) query = query.eq("outcome", filter.outcome);
  const { data, error } = await query;
  if (error) {
    console.error("[Supabase] readAgentProposalOutcomes error:", error.message);
    return [];
  }
  return (data ?? []) as AgentProposalOutcomeRecord[];
}

// ─── Health Check ───────────────────────────────────────────────

export async function checkSupabaseHealth(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const sb = getSupabaseClient();
  if (!sb) return false;

  try {
    const { error } = await sb
      .from("scored_riskflow_items")
      .select("id")
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}
