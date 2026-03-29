// [claude-code 2026-03-28] S8-T8: Agent Context Bank — unified memory storage, user-scoped partitions
import { getSupabaseClient } from '../config/supabase.js';

// ─── Types ──────────────────────────────────────────────────────

export type MemoryType = 'soul' | 'protocol' | 'observation' | 'preference' | 'artifact';

export interface AgentMemoryEntry {
  id?: string;
  user_id: string;
  agent_id: string;
  memory_type: MemoryType;
  content: string;
  metadata?: Record<string, unknown>;
  is_shared?: boolean;
  is_master?: boolean;
  exclude_from_sync?: boolean;
  created_at?: string;
  updated_at?: string;
  expires_at?: string | null;
}

export interface AgentMemoryFilter {
  agent_id?: string;
  memory_type?: MemoryType;
  is_shared?: boolean;
  include_expired?: boolean;
}

const VALID_MEMORY_TYPES: MemoryType[] = ['soul', 'protocol', 'observation', 'preference', 'artifact'];
const VALID_AGENTS = ['harper-opus', 'oracle', 'feucht', 'consul', 'herald', 'sentinel', 'charles', 'horace', 'codi', 'price'];

// ─── Validation ─────────────────────────────────────────────────

export function isValidMemoryType(t: string): t is MemoryType {
  return VALID_MEMORY_TYPES.includes(t as MemoryType);
}

export function isValidAgentId(id: string): boolean {
  return VALID_AGENTS.includes(id);
}

// ─── Read Operations ────────────────────────────────────────────

/** Get all non-excluded memories for an agent + shared memories for this user */
export async function getContextForAgent(
  userId: string,
  agentId: string,
  filter?: Pick<AgentMemoryFilter, 'memory_type' | 'include_expired'>
): Promise<AgentMemoryEntry[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  let query = sb
    .from('agent_context_bank')
    .select('*')
    .eq('user_id', userId)
    .eq('exclude_from_sync', false)
    .or(`agent_id.eq.${agentId},is_shared.eq.true`)
    .order('updated_at', { ascending: false });

  if (filter?.memory_type) {
    query = query.eq('memory_type', filter.memory_type);
  }
  if (!filter?.include_expired) {
    query = query.or('expires_at.is.null,expires_at.gt.now()');
  }

  const { data, error } = await query;

  if (error) {
    console.error('[AgentContextBank] getContextForAgent error:', error.message);
    return [];
  }
  return data ?? [];
}

/** Save or update a single memory entry */
export async function saveMemory(entry: AgentMemoryEntry): Promise<AgentMemoryEntry | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const row = {
    user_id: entry.user_id,
    agent_id: entry.agent_id,
    memory_type: entry.memory_type,
    content: entry.content,
    metadata: entry.metadata ?? {},
    is_shared: entry.is_shared ?? false,
    is_master: entry.is_master ?? false,
    exclude_from_sync: entry.exclude_from_sync ?? false,
    expires_at: entry.expires_at ?? null,
  };

  // If id provided, upsert; otherwise insert
  if (entry.id) {
    const { data, error } = await sb
      .from('agent_context_bank')
      .upsert({ id: entry.id, ...row }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('[AgentContextBank] saveMemory upsert error:', error.message);
      return null;
    }
    return data;
  }

  const { data, error } = await sb
    .from('agent_context_bank')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('[AgentContextBank] saveMemory insert error:', error.message);
    return null;
  }
  return data;
}

/** Bulk sync from Claude CLI memory — upserts by matching user_id + agent_id + content hash */
export async function syncFromCliMemory(
  userId: string,
  entries: Omit<AgentMemoryEntry, 'user_id'>[]
): Promise<{ synced: number; errors: number }> {
  const sb = getSupabaseClient();
  if (!sb) return { synced: 0, errors: 0 };

  let synced = 0;
  let errors = 0;

  for (const entry of entries) {
    const row = {
      user_id: userId,
      agent_id: entry.agent_id,
      memory_type: entry.memory_type,
      content: entry.content,
      metadata: entry.metadata ?? {},
      is_shared: entry.is_shared ?? false,
      is_master: entry.is_master ?? false,
      exclude_from_sync: entry.exclude_from_sync ?? false,
      expires_at: entry.expires_at ?? null,
    };

    // Check for existing entry with same content for this user+agent
    const { data: existing } = await sb
      .from('agent_context_bank')
      .select('id')
      .eq('user_id', userId)
      .eq('agent_id', entry.agent_id)
      .eq('content', entry.content)
      .limit(1)
      .single();

    if (existing) {
      // Update existing
      const { error } = await sb
        .from('agent_context_bank')
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq('id', existing.id);

      if (error) {
        console.error('[AgentContextBank] sync update error:', error.message);
        errors++;
      } else {
        synced++;
      }
    } else {
      // Insert new
      const { error } = await sb
        .from('agent_context_bank')
        .insert(row);

      if (error) {
        console.error('[AgentContextBank] sync insert error:', error.message);
        errors++;
      } else {
        synced++;
      }
    }
  }

  console.log(`[AgentContextBank] Sync complete: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

/** Get shared protocol entries (soul + protocol) visible to all agents for a user */
export async function getSharedProtocol(userId: string): Promise<AgentMemoryEntry[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('agent_context_bank')
    .select('*')
    .eq('user_id', userId)
    .eq('is_shared', true)
    .in('memory_type', ['soul', 'protocol'])
    .or('expires_at.is.null,expires_at.gt.now()')
    .order('memory_type')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[AgentContextBank] getSharedProtocol error:', error.message);
    return [];
  }
  return data ?? [];
}

/** Copy master template entries to a new user's partition */
export async function seedNewUser(userId: string): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb) return 0;

  // Get all master template entries
  const { data: masters, error: fetchErr } = await sb
    .from('agent_context_bank')
    .select('*')
    .eq('is_master', true);

  if (fetchErr || !masters?.length) {
    if (fetchErr) console.error('[AgentContextBank] seedNewUser fetch error:', fetchErr.message);
    return 0;
  }

  // Clone each master entry for the new user
  const cloned = masters.map((m) => ({
    user_id: userId,
    agent_id: m.agent_id,
    memory_type: m.memory_type,
    content: m.content,
    metadata: { ...m.metadata, seeded_from: m.id },
    is_shared: m.is_shared,
    is_master: false,
    exclude_from_sync: m.exclude_from_sync,
    expires_at: m.expires_at,
  }));

  const { data, error } = await sb
    .from('agent_context_bank')
    .insert(cloned)
    .select('id');

  if (error) {
    console.error('[AgentContextBank] seedNewUser insert error:', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/** Delete a single memory entry (owned by user) */
export async function deleteMemory(userId: string, memoryId: string): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb
    .from('agent_context_bank')
    .delete()
    .eq('id', memoryId)
    .eq('user_id', userId);

  if (error) {
    console.error('[AgentContextBank] deleteMemory error:', error.message);
    return false;
  }
  return true;
}

/** Get all memories for a user (admin/handoff use) */
export async function getAllUserMemories(userId: string): Promise<AgentMemoryEntry[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('agent_context_bank')
    .select('*')
    .eq('user_id', userId)
    .order('agent_id')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[AgentContextBank] getAllUserMemories error:', error.message);
    return [];
  }
  return data ?? [];
}
