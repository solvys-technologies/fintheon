// [claude-code 2026-03-19] Supabase cloud service — centralized scoring, ER persistence, user settings, consilium
import { getSupabaseClient, isSupabaseConfigured } from '../config/supabase.js';

// ─── Types ──────────────────────────────────────────────────────

export interface RawRiskFlowItem {
  tweet_id: string;
  source?: string;
  headline?: string;
  body?: string;
  symbols?: string[];
  tags?: string[];
  is_breaking?: boolean;
  urgency?: string;
  published_at?: string;
  submitted_by?: string;
}

export interface ScoredRiskFlowItem extends RawRiskFlowItem {
  raw_item_id?: string;
  sentiment?: string;
  iv_score?: number;
  macro_level?: number;
  analyzed_at?: string;
  scored_by?: string;
  price_brain_score?: Record<string, unknown>;
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
  const sb = getSupabaseClient();
  if (!sb || items.length === 0) return 0;

  const { data, error } = await sb
    .from('raw_riskflow_items')
    .upsert(items, { onConflict: 'tweet_id', ignoreDuplicates: true })
    .select('id');

  if (error) {
    console.error('[Supabase] writeRawItems error:', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

export async function readUnscoredItems(limit = 50): Promise<(RawRiskFlowItem & { id: string })[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  // Items in raw_riskflow_items that have no matching scored entry
  const { data, error } = await sb
    .from('raw_riskflow_items')
    .select('*')
    .not('tweet_id', 'in', sb.from('scored_riskflow_items').select('tweet_id'))
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    // Fallback: just get recent raw items and filter client-side
    console.warn('[Supabase] readUnscoredItems subquery failed, using fallback:', error.message);
    return await readUnscoredItemsFallback(limit);
  }
  return data ?? [];
}

async function readUnscoredItemsFallback(limit: number): Promise<(RawRiskFlowItem & { id: string })[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  // Get recent raw items
  const { data: rawItems } = await sb
    .from('raw_riskflow_items')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit * 2);

  if (!rawItems?.length) return [];

  // Get scored tweet_ids
  const tweetIds = rawItems.map((r) => r.tweet_id);
  const { data: scoredItems } = await sb
    .from('scored_riskflow_items')
    .select('tweet_id')
    .in('tweet_id', tweetIds);

  const scoredSet = new Set((scoredItems ?? []).map((s) => s.tweet_id));
  return rawItems.filter((r) => !scoredSet.has(r.tweet_id)).slice(0, limit);
}

// ─── Scored Items (central agent writes, all read) ──────────────

export async function writeScoredItems(items: ScoredRiskFlowItem[]): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb || items.length === 0) return 0;

  const { data, error } = await sb
    .from('scored_riskflow_items')
    .upsert(items, { onConflict: 'tweet_id', ignoreDuplicates: false })
    .select('id');

  if (error) {
    console.error('[Supabase] writeScoredItems error:', error.message);
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
    .from('scored_riskflow_items')
    .select('*')
    .order('macro_level', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 100);

  if (options?.minMacroLevel) {
    query = query.gte('macro_level', options.minMacroLevel);
  }
  if (options?.since) {
    query = query.gte('created_at', options.since);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase] readScoredItems error:', error.message);
    return [];
  }
  return data ?? [];
}

// ─── ER Scores ──────────────────────────────────────────────────

export async function writeERSession(record: ERScoreRecord): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb.from('er_scores').insert(record);
  if (error) {
    console.error('[Supabase] writeERSession error:', error.message);
    return false;
  }
  return true;
}

export async function readERSessions(userId: string, limit = 20): Promise<ERScoreRecord[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('er_scores')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Supabase] readERSessions error:', error.message);
    return [];
  }
  return data ?? [];
}

// ─── User Settings ──────────────────────────────────────────────

export async function writeUserSettings(record: UserSettingsRecord): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb
    .from('user_settings')
    .upsert({ ...record, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) {
    console.error('[Supabase] writeUserSettings error:', error.message);
    return false;
  }
  return true;
}

export async function readUserSettings(userId: string): Promise<UserSettingsRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') { // not found is ok
      console.error('[Supabase] readUserSettings error:', error.message);
    }
    return null;
  }
  return data;
}

// ─── Consilium Messages ─────────────────────────────────────────

export async function writeConsiliumMessage(record: ConsiliumMessageRecord): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb.from('consilium_messages').insert(record);
  if (error) {
    console.error('[Supabase] writeConsiliumMessage error:', error.message);
    return false;
  }
  return true;
}

export async function readConsiliumMessages(limit = 100): Promise<ConsiliumMessageRecord[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('consilium_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[Supabase] readConsiliumMessages error:', error.message);
    return [];
  }
  return data ?? [];
}

// ─── Health Check ───────────────────────────────────────────────

export async function checkSupabaseHealth(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const sb = getSupabaseClient();
  if (!sb) return false;

  try {
    const { error } = await sb.from('scored_riskflow_items').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}
