// [claude-code 2026-03-28] S8-T8: Agent memory route handlers — CRUD + sync + protocol
import type { Context } from "hono";
import {
  getContextForAgent,
  saveMemory,
  syncFromCliMemory,
  getSharedProtocol,
  deleteMemory,
  isValidMemoryType,
  isValidAgentId,
  type AgentMemoryEntry,
} from "../../services/agent-context-bank-service.js";

// Default user_id for single-tenant (TP) — will be replaced by auth context in multi-tenant
const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

function getUserId(c: Context): string {
  // Try auth context first, fall back to header, then default
  const authUser = c.get("userId") as string | undefined;
  if (authUser) return authUser;
  const headerUser = c.req.header("x-user-id");
  if (headerUser) return headerUser;
  return DEFAULT_USER_ID;
}

/** GET /memories?agent=harper-opus&type=observation */
export async function handleGetAgentMemories(c: Context) {
  const agentId = c.req.query("agent");
  if (!agentId) {
    return c.json({ error: "Missing required query param: agent" }, 400);
  }
  if (!isValidAgentId(agentId)) {
    return c.json({ error: `Unknown agent: ${agentId}` }, 400);
  }

  const memoryType = c.req.query("type");
  if (memoryType && !isValidMemoryType(memoryType)) {
    return c.json({ error: `Invalid memory_type: ${memoryType}` }, 400);
  }

  const userId = getUserId(c);
  const memories = await getContextForAgent(userId, agentId, {
    memory_type:
      memoryType && isValidMemoryType(memoryType) ? memoryType : undefined,
    include_expired: c.req.query("include_expired") === "true",
  });

  return c.json({ memories, count: memories.length, agent: agentId });
}

/** POST /memories — save a single memory entry */
export async function handleSaveMemory(c: Context) {
  try {
    const body = await c.req.json();

    if (!body.agent_id || !body.memory_type || !body.content) {
      return c.json(
        { error: "Missing required fields: agent_id, memory_type, content" },
        400,
      );
    }
    if (!isValidAgentId(body.agent_id)) {
      return c.json({ error: `Unknown agent: ${body.agent_id}` }, 400);
    }
    if (!isValidMemoryType(body.memory_type)) {
      return c.json({ error: `Invalid memory_type: ${body.memory_type}` }, 400);
    }

    const entry: AgentMemoryEntry = {
      id: body.id,
      user_id: getUserId(c),
      agent_id: body.agent_id,
      memory_type: body.memory_type,
      content: body.content,
      metadata: body.metadata,
      is_shared: body.is_shared,
      is_master: body.is_master,
      exclude_from_sync: body.exclude_from_sync,
      expires_at: body.expires_at,
    };

    const saved = await saveMemory(entry);
    if (!saved) {
      return c.json(
        { error: "Failed to save memory (Supabase unavailable or error)" },
        503,
      );
    }
    return c.json({ ok: true, memory: saved });
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
}

/** POST /memories/sync — bulk sync from CLI memory */
export async function handleSyncMemories(c: Context) {
  try {
    const body = await c.req.json();

    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      return c.json({ error: "Missing or empty entries array" }, 400);
    }

    // Validate each entry minimally
    for (const e of body.entries) {
      if (!e.agent_id || !e.memory_type || !e.content) {
        return c.json(
          { error: "Each entry must have agent_id, memory_type, content" },
          400,
        );
      }
    }

    const userId = getUserId(c);
    const result = await syncFromCliMemory(userId, body.entries);
    return c.json({ ok: true, ...result });
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
}

/** GET /memories/protocol — shared soul + protocol entries */
export async function handleGetProtocol(c: Context) {
  const userId = getUserId(c);
  const protocol = await getSharedProtocol(userId);
  return c.json({ protocol, count: protocol.length });
}

/** DELETE /memories/:id — remove a memory entry */
export async function handleDeleteMemory(c: Context) {
  const memoryId = c.req.param("id");
  if (!memoryId) {
    return c.json({ error: "Missing memory id" }, 400);
  }

  const userId = getUserId(c);
  const deleted = await deleteMemory(userId, memoryId);
  if (!deleted) {
    return c.json(
      { error: "Failed to delete memory (not found or Supabase error)" },
      404,
    );
  }
  return c.json({ ok: true, deleted: memoryId });
}
