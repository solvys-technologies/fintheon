// [claude-code 2026-03-26] T1: Agent Thought Bank store — CRUD + cross-agent query
import { sql, isDatabaseAvailable } from "../config/database.js";
import {
  mapRowToThought,
  type ThoughtBankRow,
  type AgentThought,
  type ThoughtBankInput,
  type ThoughtBankFilter,
  type ThoughtBankContext,
} from "../types/thought-bank.js";
import { VALID_AGENTS, type AgentName } from "../types/context-bank.js";

// ---------------------------------------------------------------------------
// In-memory fallback when DB is unavailable
// ---------------------------------------------------------------------------
const MEMORY_CAP = 200;
const memoryThoughts: AgentThought[] = [];

/** Store a new thought. Returns the created thought. */
export async function storeThought(
  input: ThoughtBankInput,
): Promise<AgentThought> {
  if (!isDatabaseAvailable() || !sql) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const thought: AgentThought = {
      id,
      agent: input.agent,
      category: input.category,
      title: input.title ?? null,
      fullAnalysis: input.fullAnalysis,
      briefSummary: input.briefSummary,
      sessionId: input.sessionId ?? null,
      boardroomMessageId: input.boardroomMessageId ?? null,
      contextSnapshotVersion: input.contextSnapshotVersion ?? null,
      instruments: input.instruments ?? [],
      confidence: input.confidence ?? 0.5,
      referencedThoughtIds: input.referencedThoughtIds ?? [],
      metadata: input.metadata ?? {},
      createdAt: now,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    };
    memoryThoughts.unshift(thought);
    if (memoryThoughts.length > MEMORY_CAP) memoryThoughts.pop();
    return thought;
  }

  const result = await sql`
    INSERT INTO agent_thought_bank (
      agent, category, title, full_analysis, brief_summary,
      session_id, boardroom_message_id, context_snapshot_version,
      instruments, confidence, referenced_thought_ids, metadata
    ) VALUES (
      ${input.agent},
      ${input.category},
      ${input.title ?? null},
      ${input.fullAnalysis},
      ${input.briefSummary},
      ${input.sessionId ?? null},
      ${input.boardroomMessageId ?? null},
      ${input.contextSnapshotVersion ?? null},
      ${JSON.stringify(input.instruments ?? [])}::text[],
      ${input.confidence ?? 0.5},
      ${JSON.stringify(input.referencedThoughtIds ?? [])}::uuid[],
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING *
  `;
  return mapRowToThought(result[0] as ThoughtBankRow);
}

/** Get a thought by its UUID. */
export async function getThoughtById(id: string): Promise<AgentThought | null> {
  if (!isDatabaseAvailable() || !sql) {
    return memoryThoughts.find((t) => t.id === id) ?? null;
  }

  const result =
    await sql`SELECT * FROM agent_thought_bank WHERE id = ${id} LIMIT 1`;
  if (result.length === 0) return null;
  return mapRowToThought(result[0] as ThoughtBankRow);
}

/** Get a thought linked to a specific boardroom message. */
export async function getThoughtByMessageId(
  messageId: string,
): Promise<AgentThought | null> {
  if (!isDatabaseAvailable() || !sql) {
    return (
      memoryThoughts.find((t) => t.boardroomMessageId === messageId) ?? null
    );
  }

  const result = await sql`
    SELECT * FROM agent_thought_bank
    WHERE boardroom_message_id = ${messageId}
    LIMIT 1
  `;
  if (result.length === 0) return null;
  return mapRowToThought(result[0] as ThoughtBankRow);
}

/** Link a thought to its boardroom message after posting. */
export async function updateThoughtMessageId(
  thoughtId: string,
  messageId: string,
): Promise<void> {
  if (!isDatabaseAvailable() || !sql) {
    const thought = memoryThoughts.find((t) => t.id === thoughtId);
    if (thought) thought.boardroomMessageId = messageId;
    return;
  }

  await sql`
    UPDATE agent_thought_bank
    SET boardroom_message_id = ${messageId}
    WHERE id = ${thoughtId}
  `;
}

/** Get thoughts for a specific agent. */
export async function getAgentThoughts(
  agent: AgentName,
  filter?: ThoughtBankFilter,
): Promise<AgentThought[]> {
  const limit = filter?.limit ?? 20;

  if (!isDatabaseAvailable() || !sql) {
    let thoughts = memoryThoughts.filter((t) => t.agent === agent);
    if (filter?.category)
      thoughts = thoughts.filter((t) => t.category === filter.category);
    if (filter?.since)
      thoughts = thoughts.filter((t) => t.createdAt >= filter.since!);
    return thoughts.slice(0, limit);
  }

  const hasCat = !!filter?.category;
  const hasSince = !!filter?.since;

  if (!hasCat && !hasSince) {
    const result = await sql`
      SELECT * FROM agent_thought_bank
      WHERE agent = ${agent}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return result.map((r) => mapRowToThought(r as ThoughtBankRow));
  }

  const result = await sql`
    SELECT * FROM agent_thought_bank
    WHERE agent = ${agent}
      AND (${filter?.category ?? null}::text IS NULL OR category = ${filter?.category ?? null})
      AND (${filter?.since ?? null}::timestamptz IS NULL OR created_at >= ${filter?.since ?? null}::timestamptz)
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return result.map((r) => mapRowToThought(r as ThoughtBankRow));
}

/** Get recent thoughts across all agents. */
export async function getRecentThoughts(
  filter?: ThoughtBankFilter,
): Promise<AgentThought[]> {
  const limit = filter?.limit ?? 20;

  if (!isDatabaseAvailable() || !sql) {
    let thoughts = [...memoryThoughts];
    if (filter?.agent)
      thoughts = thoughts.filter((t) => t.agent === filter.agent);
    if (filter?.category)
      thoughts = thoughts.filter((t) => t.category === filter.category);
    if (filter?.since)
      thoughts = thoughts.filter((t) => t.createdAt >= filter.since!);
    return thoughts.slice(0, limit);
  }

  const result = await sql`
    SELECT * FROM agent_thought_bank
    WHERE (${filter?.agent ?? null}::text IS NULL OR agent = ${filter?.agent ?? null})
      AND (${filter?.category ?? null}::text IS NULL OR category = ${filter?.category ?? null})
      AND (${filter?.since ?? null}::timestamptz IS NULL OR created_at >= ${filter?.since ?? null}::timestamptz)
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return result.map((r) => mapRowToThought(r as ThoughtBankRow));
}

/**
 * Build cross-agent thought context for prompt injection.
 * Returns recent thoughts from ALL agents EXCEPT the specified one.
 * Max 4 hours old, default 3 per agent.
 */
export async function buildThoughtBankContext(
  excludeAgent: AgentName,
  limitPerAgent = 3,
): Promise<ThoughtBankContext[]> {
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const otherAgents = VALID_AGENTS.filter((a) => a !== excludeAgent);
  const contexts: ThoughtBankContext[] = [];

  for (const agent of otherAgents) {
    const thoughts = await getAgentThoughts(agent, {
      since: fourHoursAgo,
      limit: limitPerAgent,
    });

    for (const t of thoughts) {
      contexts.push({
        agent: t.agent,
        title: t.title,
        briefSummary: t.briefSummary,
        instruments: t.instruments,
        confidence: t.confidence,
        createdAt: t.createdAt,
        ageMinutes: (Date.now() - new Date(t.createdAt).getTime()) / 60000,
      });
    }
  }

  // Sort by recency
  contexts.sort((a, b) => a.ageMinutes - b.ageMinutes);
  return contexts;
}
