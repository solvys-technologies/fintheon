// [claude-code 2026-03-23] T1: Boardroom DB schema + store service
// [claude-code 2026-03-23] Touch-up: use BoardroomAgent union, add emoji field, adapter to legacy type

import type { BoardroomAgent, BoardroomMessage } from "./boardroom.js";

export type ContentPartType =
  | "text"
  | "analysis"
  | "trade-idea"
  | "chart-ref"
  | "reaction";

export interface ContentPart {
  type: ContentPartType;
  data: unknown;
}

/** DB row shape (snake_case) for boardroom_sessions */
export interface BoardroomSessionRow {
  id: string;
  session_date: string;
  title: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** DB row shape (snake_case) for boardroom_messages */
export interface BoardroomMessageRow {
  id: string;
  session_id: string;
  agent: string;
  role: string;
  content: string;
  message_type: string;
  metadata: Record<string, unknown>;
  thread_id?: string | null;
  peer_id?: string | null;
  content_parts?: ContentPart[] | null;
  created_at: string;
}

/** Application-level session (camelCase) */
export interface BoardroomSession {
  id: string;
  sessionDate: string;
  title: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Application-level message (camelCase) — uses BoardroomAgent union for type safety */
export interface BoardroomDBMessage {
  id: string;
  sessionId: string;
  agent: BoardroomAgent;
  role: string;
  content: string;
  messageType: string;
  metadata: Record<string, unknown>;
  threadId?: string | null;
  peerId?: string | null;
  contentParts?: ContentPart[] | null;
  createdAt: string;
}

/** Agent emoji lookup — matches hermes-sessions.ts AGENT_PATTERNS */
const AGENT_EMOJIS: Record<BoardroomAgent, string> = {
  "Harper-Opus": "🎩",
  Feucht: "⚡",
  Consul: "📜",
  Oracle: "📊",
  Herald: "👴",
  Unknown: "❓",
};

/** Filter options for querying messages */
export interface BoardroomSessionFilter {
  agent?: BoardroomAgent;
  search?: string;
  since?: string;
  until?: string;
  messageType?: string;
  limit?: number;
  offset?: number;
}

/** Input for creating a new boardroom message */
export interface BoardroomMessageInput {
  agent: BoardroomAgent;
  role: string;
  content: string;
  messageType?: string;
  metadata?: Record<string, unknown>;
  threadId?: string | null;
  peerId?: string | null;
  contentParts?: ContentPart[] | null;
}

/** Coerce a raw string to BoardroomAgent (DB stores as VARCHAR) */
function toAgent(raw: string): BoardroomAgent {
  const valid: BoardroomAgent[] = [
    "Harper-Opus",
    "Feucht",
    "Consul",
    "Oracle",
    "Herald",
  ];
  return valid.includes(raw as BoardroomAgent)
    ? (raw as BoardroomAgent)
    : "Unknown";
}

/** Map a DB session row to the application interface */
export function mapRowToSession(row: BoardroomSessionRow): BoardroomSession {
  return {
    id: row.id,
    sessionDate: String(row.session_date),
    title: row.title ?? "Daily Session",
    metadata: row.metadata ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Map a DB message row to the application interface */
export function mapRowToMessage(row: BoardroomMessageRow): BoardroomDBMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    agent: toAgent(row.agent),
    role: row.role,
    content: row.content,
    messageType: row.message_type ?? "chat",
    metadata: row.metadata ?? {},
    threadId: row.thread_id ?? null,
    peerId: row.peer_id ?? null,
    contentParts: row.content_parts ?? null,
    createdAt: String(row.created_at),
  };
}

/** Convert a DB message to the legacy BoardroomMessage format (used by existing UI) */
export function toLegacyMessage(msg: BoardroomDBMessage): BoardroomMessage {
  return {
    id: msg.id,
    agent: msg.agent,
    emoji: AGENT_EMOJIS[msg.agent] ?? "❓",
    content: msg.content,
    timestamp: msg.createdAt,
    role: msg.role as "user" | "assistant" | "system",
    metadata: msg.metadata,
  };
}
