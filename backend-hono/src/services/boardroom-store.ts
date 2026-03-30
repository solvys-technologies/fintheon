// [claude-code 2026-03-23] T1: Boardroom DB schema + store service
// [claude-code 2026-03-23] Touch-up: memory cap, BoardroomAgent types

import { sql, isDatabaseAvailable } from '../config/database.js'
import {
  mapRowToSession,
  mapRowToMessage,
  type BoardroomSessionRow,
  type BoardroomMessageRow,
  type BoardroomSession,
  type BoardroomDBMessage,
  type BoardroomSessionFilter,
  type BoardroomMessageInput,
} from '../types/boardroom-db.js'

// ---------------------------------------------------------------------------
// In-memory fallback when DB is unavailable
// ---------------------------------------------------------------------------
const MEMORY_MESSAGES_MAX = 500

const memoryStore = {
  sessions: new Map<string, BoardroomSession>(),
  messages: new Map<string, BoardroomDBMessage[]>(),
}

function isLegacyBoardroomSchema(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes('thread_id') ||
    msg.includes('peer_id') ||
    msg.includes('content_parts') ||
    msg.includes('column')
  )
}

/** Get today's date in EST as YYYY-MM-DD */
function todayEST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** Get (or create) today's boardroom session (EST-based). */
export async function getOrCreateTodaySession(): Promise<BoardroomSession> {
  const today = todayEST()

  if (!isDatabaseAvailable() || !sql) {
    const existing = Array.from(memoryStore.sessions.values()).find(
      (s) => s.sessionDate === today
    )
    if (existing) return existing

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const session: BoardroomSession = {
      id,
      sessionDate: today,
      title: 'Daily Session',
      metadata: {},
      createdAt: now,
      updatedAt: now,
    }
    memoryStore.sessions.set(id, session)
    memoryStore.messages.set(id, [])
    return session
  }

  const result = await sql`
    INSERT INTO boardroom_sessions (session_date)
    VALUES (${today}::date)
    ON CONFLICT (session_date) DO UPDATE SET updated_at = NOW()
    RETURNING *
  `
  return mapRowToSession(result[0] as BoardroomSessionRow)
}

/** Get a session by its date string (YYYY-MM-DD). */
export async function getSessionByDate(date: string): Promise<BoardroomSession | null> {
  if (!isDatabaseAvailable() || !sql) {
    return (
      Array.from(memoryStore.sessions.values()).find((s) => s.sessionDate === date) ??
      null
    )
  }

  const result = await sql`
    SELECT * FROM boardroom_sessions WHERE session_date = ${date}::date LIMIT 1
  `
  if (result.length === 0) return null
  return mapRowToSession(result[0] as BoardroomSessionRow)
}

/** List recent sessions (newest first). */
export async function listSessions(limit = 30): Promise<BoardroomSession[]> {
  if (!isDatabaseAvailable() || !sql) {
    return Array.from(memoryStore.sessions.values())
      .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
      .slice(0, limit)
  }

  const result = await sql`
    SELECT * FROM boardroom_sessions
    ORDER BY session_date DESC
    LIMIT ${limit}
  `
  return result.map((row) => mapRowToSession(row as BoardroomSessionRow))
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** Add a message to a session. */
export async function addBoardroomMessage(
  sessionId: string,
  msg: BoardroomMessageInput
): Promise<BoardroomDBMessage> {
  if (!isDatabaseAvailable() || !sql) {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const message: BoardroomDBMessage = {
      id,
      sessionId,
      agent: msg.agent,
      role: msg.role,
      content: msg.content,
      messageType: msg.messageType ?? 'chat',
      metadata: msg.metadata ?? {},
      threadId: msg.threadId ?? null,
      peerId: msg.peerId ?? null,
      contentParts: msg.contentParts ?? null,
      createdAt: now,
    }
    const list = memoryStore.messages.get(sessionId) ?? []
    list.push(message)
    // Cap in-memory fallback to prevent unbounded growth
    if (list.length > MEMORY_MESSAGES_MAX) list.splice(0, list.length - MEMORY_MESSAGES_MAX)
    memoryStore.messages.set(sessionId, list)
    return message
  }

  let result: any[] = []
  try {
    result = await sql`
      INSERT INTO boardroom_messages (
        session_id,
        agent,
        role,
        content,
        message_type,
        metadata,
        thread_id,
        peer_id,
        content_parts
      )
      VALUES (
        ${sessionId},
        ${msg.agent},
        ${msg.role},
        ${msg.content},
        ${msg.messageType ?? 'chat'},
        ${JSON.stringify(msg.metadata ?? {})}::jsonb,
        ${msg.threadId ?? null},
        ${msg.peerId ?? null},
        ${msg.contentParts ? JSON.stringify(msg.contentParts) : null}::jsonb
      )
      RETURNING *
    `
  } catch (error) {
    if (!isLegacyBoardroomSchema(error)) throw error

    // Backward compatibility: old deployments before nullable thread/peer/content_parts columns.
    result = await sql`
      INSERT INTO boardroom_messages (session_id, agent, role, content, message_type, metadata)
      VALUES (
        ${sessionId},
        ${msg.agent},
        ${msg.role},
        ${msg.content},
        ${msg.messageType ?? 'chat'},
        ${JSON.stringify(msg.metadata ?? {})}::jsonb
      )
      RETURNING *
    `
  }

  // Bump session updated_at
  await sql`UPDATE boardroom_sessions SET updated_at = NOW() WHERE id = ${sessionId}`

  return mapRowToMessage(result[0] as BoardroomMessageRow)
}

/** Get messages for a session with optional filtering. */
export async function getSessionMessages(
  sessionId: string,
  filter?: BoardroomSessionFilter
): Promise<BoardroomDBMessage[]> {
  const limit = filter?.limit ?? 200
  const offset = filter?.offset ?? 0

  if (!isDatabaseAvailable() || !sql) {
    let msgs = memoryStore.messages.get(sessionId) ?? []
    if (filter?.agent) msgs = msgs.filter((m) => m.agent === filter.agent)
    if (filter?.messageType) msgs = msgs.filter((m) => m.messageType === filter.messageType)
    if (filter?.since) msgs = msgs.filter((m) => m.createdAt >= filter.since!)
    if (filter?.until) msgs = msgs.filter((m) => m.createdAt <= filter.until!)
    if (filter?.search) {
      const q = filter.search.toLowerCase()
      msgs = msgs.filter((m) => m.content.toLowerCase().includes(q))
    }
    return msgs.slice(offset, offset + limit)
  }

  // Build dynamic query — Neon tagged-template doesn't support fragment interpolation,
  // so we branch into explicit query variants similar to conversation-store.ts pattern.
  const hasAgent = !!filter?.agent
  const hasType = !!filter?.messageType
  const hasSince = !!filter?.since
  const hasUntil = !!filter?.until
  const hasSearch = !!filter?.search

  // Base case: no filters
  if (!hasAgent && !hasType && !hasSince && !hasUntil && !hasSearch) {
    const result = await sql`
      SELECT * FROM boardroom_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `
    return result.map((r) => mapRowToMessage(r as BoardroomMessageRow))
  }

  // Filtered: build conditions array and use a single flexible query
  // We pass all possible filter values and use COALESCE/null tricks
  const result = await sql`
    SELECT * FROM boardroom_messages
    WHERE session_id = ${sessionId}
      AND (${filter?.agent ?? null}::text IS NULL OR agent = ${filter?.agent ?? null})
      AND (${filter?.messageType ?? null}::text IS NULL OR message_type = ${filter?.messageType ?? null})
      AND (${filter?.since ?? null}::timestamptz IS NULL OR created_at >= ${filter?.since ?? null}::timestamptz)
      AND (${filter?.until ?? null}::timestamptz IS NULL OR created_at <= ${filter?.until ?? null}::timestamptz)
      AND (${filter?.search ?? null}::text IS NULL OR content ILIKE '%' || ${filter?.search ?? ''} || '%')
    ORDER BY created_at ASC
    LIMIT ${limit} OFFSET ${offset}
  `
  return result.map((r) => mapRowToMessage(r as BoardroomMessageRow))
}

/** Get replies for a specific parent message thread. */
export async function getThreadReplies(parentId: string): Promise<BoardroomDBMessage[]> {
  if (!isDatabaseAvailable() || !sql) {
    const replies: BoardroomDBMessage[] = []
    for (const list of memoryStore.messages.values()) {
      replies.push(...list.filter((message) => message.threadId === parentId))
    }
    return replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  try {
    const result = await sql`
      SELECT * FROM boardroom_messages
      WHERE thread_id = ${parentId}
      ORDER BY created_at ASC
    `
    return result.map((row) => mapRowToMessage(row as BoardroomMessageRow))
  } catch (error) {
    if (isLegacyBoardroomSchema(error)) return []
    throw error
  }
}
