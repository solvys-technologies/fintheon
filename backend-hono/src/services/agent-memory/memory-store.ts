// [claude-code 2026-04-16] T4: Per-agent persistent memory CRUD
// Complements thought-bank (ephemeral 48h cross-agent) with long-term per-agent learning

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import type {
  AgentMemory,
  AddMemoryInput,
  AgentId,
  MemoryType,
} from "./types.js";

const log = createLogger("AgentMemory");

// In-memory fallback (200 items max) for when Supabase is unavailable
const memoryCache: AgentMemory[] = [];
const MAX_CACHE = 200;

export async function addMemory(
  input: AddMemoryInput,
): Promise<AgentMemory | null> {
  const expiresAt = input.ttlHours
    ? new Date(Date.now() + input.ttlHours * 3600_000).toISOString()
    : null;

  const record: AgentMemory = {
    id: crypto.randomUUID(),
    agentId: input.agentId,
    memoryType: input.memoryType,
    content: input.content,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString(),
    expiresAt,
  };

  const sb = getSupabaseClient();
  if (sb) {
    const { data, error } = await sb
      .from("agent_memory")
      .insert({
        agent_id: record.agentId,
        memory_type: record.memoryType,
        content: record.content,
        metadata: record.metadata,
        expires_at: record.expiresAt,
      })
      .select("id")
      .single();

    if (error) {
      log.warn("Failed to persist memory, using in-memory fallback", {
        error: error.message,
        agent: input.agentId,
      });
      pushToCache(record);
      return record;
    }

    record.id = data.id;
    log.info("Memory stored", { agent: input.agentId, type: input.memoryType });
    return record;
  }

  pushToCache(record);
  return record;
}

export async function getMemories(
  agentId: AgentId,
  type?: MemoryType,
  limit: number = 10,
): Promise<AgentMemory[]> {
  const sb = getSupabaseClient();
  if (sb) {
    let query = sb
      .from("agent_memory")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (type) query = query.eq("memory_type", type);

    // Exclude expired entries
    query = query.or(
      `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`,
    );

    const { data, error } = await query;
    if (error) {
      log.warn("Failed to fetch memories, falling back to cache", {
        error: error.message,
      });
      return getCachedMemories(agentId, type, limit);
    }

    return (data ?? []).map(rowToMemory);
  }

  return getCachedMemories(agentId, type, limit);
}

export async function pruneExpired(): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb) {
    const before = memoryCache.length;
    const now = new Date().toISOString();
    const filtered = memoryCache.filter(
      (m) => !m.expiresAt || m.expiresAt > now,
    );
    memoryCache.length = 0;
    memoryCache.push(...filtered);
    return before - memoryCache.length;
  }

  const { data, error } = await sb
    .from("agent_memory")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .not("expires_at", "is", null)
    .select("id");

  if (error) {
    log.warn("Prune failed", { error: error.message });
    return 0;
  }

  const count = data?.length ?? 0;
  if (count > 0) log.info(`Pruned ${count} expired memories`);
  return count;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function rowToMemory(row: Record<string, unknown>): AgentMemory {
  return {
    id: row.id as string,
    agentId: row.agent_id as AgentId,
    memoryType: row.memory_type as MemoryType,
    content: row.content as string,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    expiresAt: (row.expires_at as string) ?? null,
  };
}

function pushToCache(memory: AgentMemory): void {
  memoryCache.push(memory);
  if (memoryCache.length > MAX_CACHE) {
    memoryCache.splice(0, memoryCache.length - MAX_CACHE);
  }
}

function getCachedMemories(
  agentId: AgentId,
  type: MemoryType | undefined,
  limit: number,
): AgentMemory[] {
  const now = new Date().toISOString();
  return memoryCache
    .filter(
      (m) =>
        m.agentId === agentId &&
        (!type || m.memoryType === type) &&
        (!m.expiresAt || m.expiresAt > now),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
