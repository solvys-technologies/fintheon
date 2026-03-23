// [claude-code 2026-03-23] T1: Boardroom DB schema + store service

/** DB row shape (snake_case) for boardroom_sessions */
export interface BoardroomSessionRow {
  id: string
  session_date: string
  title: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

/** DB row shape (snake_case) for boardroom_messages */
export interface BoardroomMessageRow {
  id: string
  session_id: string
  agent: string
  role: string
  content: string
  message_type: string
  metadata: Record<string, unknown>
  created_at: string
}

/** Application-level session (camelCase) */
export interface BoardroomSession {
  id: string
  sessionDate: string
  title: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/** Application-level message (camelCase) */
export interface BoardroomDBMessage {
  id: string
  sessionId: string
  agent: string
  role: string
  content: string
  messageType: string
  metadata: Record<string, unknown>
  createdAt: string
}

/** Filter options for querying messages */
export interface BoardroomSessionFilter {
  agent?: string
  search?: string
  since?: string
  until?: string
  messageType?: string
  limit?: number
  offset?: number
}

/** Input for creating a new boardroom message */
export interface BoardroomMessageInput {
  agent: string
  role: string
  content: string
  messageType?: string
  metadata?: Record<string, unknown>
}

/** Map a DB session row to the application interface */
export function mapRowToSession(row: BoardroomSessionRow): BoardroomSession {
  return {
    id: row.id,
    sessionDate: String(row.session_date),
    title: row.title ?? 'Daily Session',
    metadata: row.metadata ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

/** Map a DB message row to the application interface */
export function mapRowToMessage(row: BoardroomMessageRow): BoardroomDBMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    agent: row.agent,
    role: row.role,
    content: row.content,
    messageType: row.message_type ?? 'chat',
    metadata: row.metadata ?? {},
    createdAt: String(row.created_at),
  }
}
