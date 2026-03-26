// [claude-code 2026-03-20] Supabase cloud service — full data layer replacing Notion + scoring, ER, settings, consilium
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
  sub_scores?: Record<string, unknown>;
  risk_type?: string;
  agent_note?: string;
  agent_note_generated_at?: string;
  econ_data?: Record<string, unknown>;
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

// ─── Trade Ideas ────────────────────────────────────────────────

export interface TradeIdeaRecord {
  id?: string;
  title: string;
  ticker?: string;
  direction?: 'Long' | 'Short';
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

export async function writeTradeIdea(idea: Omit<TradeIdeaRecord, 'id' | 'created_at' | 'updated_at'>): Promise<TradeIdeaRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from('trade_ideas')
    .insert(idea)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] writeTradeIdea error:', error.message);
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
    .from('trade_ideas')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filter?.limit ?? 100);

  if (filter?.status) {
    query = query.eq('status', filter.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase] readTradeIdeas error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function updateTradeIdeaStatus(id: string, status: string): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb
    .from('trade_ideas')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[Supabase] updateTradeIdeaStatus error:', error.message);
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

export async function writeDailyPnl(record: Omit<DailyPnlRecord, 'id' | 'created_at'>): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb
    .from('daily_pnl')
    .upsert(record, { onConflict: 'date' });

  if (error) {
    console.error('[Supabase] writeDailyPnl error:', error.message);
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
    .from('daily_pnl')
    .select('*')
    .order('date', { ascending: false })
    .limit(filter?.limit ?? 30);

  if (filter?.from) query = query.gte('date', filter.from);
  if (filter?.to) query = query.lte('date', filter.to);

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase] readDailyPnl error:', error.message);
    return [];
  }
  return data ?? [];
}

// ─── Briefs ─────────────────────────────────────────────────────

export type BriefType = 'MDB' | 'ADB' | 'PMDB' | 'TOTT';

export interface BriefRecord {
  id?: string;
  brief_type: BriefType;
  content: string;
  generated_by?: string;
  status?: string;
  category?: string;
  created_at?: string;
}

export async function writeBrief(brief: Omit<BriefRecord, 'id' | 'created_at'>): Promise<BriefRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  // Archive previous active briefs of same type
  await sb
    .from('briefs')
    .update({ status: 'Archived' })
    .eq('brief_type', brief.brief_type)
    .eq('status', 'Active');

  const { data, error } = await sb
    .from('briefs')
    .insert({ ...brief, status: brief.status ?? 'Active' })
    .select()
    .single();

  if (error) {
    console.error('[Supabase] writeBrief error:', error.message);
    return null;
  }
  return data;
}

export async function readBriefs(type?: BriefType, limit = 10): Promise<BriefRecord[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  let query = sb
    .from('briefs')
    .select('*')
    .eq('status', 'Active')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (type) query = query.eq('brief_type', type);

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase] readBriefs error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function readLatestBrief(type: BriefType): Promise<BriefRecord | null> {
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
  impact?: 'low' | 'medium' | 'high';
  created_at?: string;
  updated_at?: string;
}

export async function writeEconEvent(event: Omit<EconEventRecord, 'id' | 'created_at' | 'updated_at'>): Promise<EconEventRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from('economic_events')
    .insert(event)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] writeEconEvent error:', error.message);
    return null;
  }
  return data;
}

export async function readEconEvents(dateRange?: {
  from?: string;
  to?: string;
}): Promise<EconEventRecord[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  let query = sb
    .from('economic_events')
    .select('*')
    .order('date', { ascending: true })
    .limit(100);

  if (dateRange?.from) query = query.gte('date', dateRange.from);
  if (dateRange?.to) query = query.lte('date', dateRange.to);

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase] readEconEvents error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function updateEconEventActual(id: string, actual: string): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb
    .from('economic_events')
    .update({ actual, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[Supabase] updateEconEventActual error:', error.message);
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

export async function writeEconPrint(print: Omit<EconPrintRecord, 'id' | 'printed_at'>): Promise<EconPrintRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from('econ_prints')
    .insert(print)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] writeEconPrint error:', error.message);
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
    .from('econ_prints')
    .select('*')
    .order('printed_at', { ascending: false })
    .limit(filter?.limit ?? 50);

  if (filter?.eventName) {
    query = query.ilike('headline', `%${filter.eventName}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase] readEconPrints error:', error.message);
    return [];
  }
  return data ?? [];
}

// ─── ER Events (PsychAssist deterministic scoring) ─────────────

export interface EREventRecord {
  user_id: string;
  event_type: string;      // 'curse' | 'breathing' | 'decay_reset'
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

  const { error } = await sb.from('er_events').insert(record);
  if (error) {
    console.error('[Supabase] writeEREvent error:', error.message);
    return false;
  }
  return true;
}

export async function readEREvents(userId: string, limit = 50): Promise<(EREventRecord & { id: string; created_at: string })[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('er_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Supabase] readEREvents error:', error.message);
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
  tier?: 'free' | 'fintheon' | 'fintheon_plus' | 'fintheon_pro';
  onboarding_complete?: boolean;
  app_state?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export async function getOrCreateProfile(
  supabaseUid: string,
  email?: string,
  displayName?: string,
  avatarUrl?: string
): Promise<UserProfileRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  // Try to fetch existing profile
  const { data: existing, error: fetchErr } = await sb
    .from('user_profiles')
    .select('*')
    .eq('supabase_uid', supabaseUid)
    .single();

  if (existing) return existing;

  // PGRST116 = not found — create new profile
  if (fetchErr && fetchErr.code !== 'PGRST116') {
    console.error('[Supabase] getOrCreateProfile fetch error:', fetchErr.message);
    return null;
  }

  const { data: created, error: createErr } = await sb
    .from('user_profiles')
    .insert({ supabase_uid: supabaseUid, email, display_name: displayName, avatar_url: avatarUrl })
    .select()
    .single();

  if (createErr) {
    console.error('[Supabase] getOrCreateProfile create error:', createErr.message);
    return null;
  }
  return created;
}

export async function updateProfile(
  supabaseUid: string,
  fields: Partial<Pick<UserProfileRecord, 'email' | 'display_name' | 'avatar_url' | 'tier' | 'onboarding_complete'>>
): Promise<UserProfileRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from('user_profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('supabase_uid', supabaseUid)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] updateProfile error:', error.message);
    return null;
  }
  return data;
}

export async function getAppState(supabaseUid: string): Promise<Record<string, unknown> | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from('user_profiles')
    .select('app_state')
    .eq('supabase_uid', supabaseUid)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('[Supabase] getAppState error:', error.message);
    }
    return null;
  }
  return (data?.app_state as Record<string, unknown>) ?? {};
}

export async function upsertAppState(
  supabaseUid: string,
  state: Record<string, unknown>
): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb
    .from('user_profiles')
    .update({ app_state: state, updated_at: new Date().toISOString() })
    .eq('supabase_uid', supabaseUid);

  if (error) {
    console.error('[Supabase] upsertAppState error:', error.message);
    return false;
  }
  return true;
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
