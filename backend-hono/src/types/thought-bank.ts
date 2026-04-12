// [claude-code 2026-03-26] T1: Agent Thought Bank types — per-agent deep analysis storage
import type { AgentName } from "./context-bank.js";
import { VALID_AGENTS } from "./context-bank.js";

export type ThoughtCategory =
  | "standup"
  | "news-response"
  | "broadcast"
  | "mention"
  | "scheduled"
  | "spontaneous";

/** DB row shape (snake_case) for agent_thought_bank */
export interface ThoughtBankRow {
  id: string;
  agent: string;
  category: string;
  title: string | null;
  full_analysis: string;
  brief_summary: string;
  session_id: string | null;
  boardroom_message_id: string | null;
  context_snapshot_version: number | null;
  instruments: string[];
  confidence: number;
  referenced_thought_ids: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  expires_at: string;
}

/** Application-level thought (camelCase) */
export interface AgentThought {
  id: string;
  agent: AgentName;
  category: ThoughtCategory;
  title: string | null;
  fullAnalysis: string;
  briefSummary: string;
  sessionId: string | null;
  boardroomMessageId: string | null;
  contextSnapshotVersion: number | null;
  instruments: string[];
  confidence: number;
  referencedThoughtIds: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
}

/** Input for storing a new thought */
export interface ThoughtBankInput {
  agent: AgentName;
  category: ThoughtCategory;
  title?: string;
  fullAnalysis: string;
  briefSummary: string;
  sessionId?: string;
  boardroomMessageId?: string;
  contextSnapshotVersion?: number;
  instruments?: string[];
  confidence?: number;
  referencedThoughtIds?: string[];
  metadata?: Record<string, unknown>;
}

/** Filter options for querying thoughts */
export interface ThoughtBankFilter {
  agent?: AgentName;
  category?: ThoughtCategory;
  since?: string;
  limit?: number;
}

/** Cross-agent context summary for prompt injection */
export interface ThoughtBankContext {
  agent: AgentName;
  title: string | null;
  briefSummary: string;
  instruments: string[];
  confidence: number;
  createdAt: string;
  ageMinutes: number;
}

/** Coerce a raw string to AgentName */
function toAgent(raw: string): AgentName {
  return VALID_AGENTS.includes(raw as AgentName)
    ? (raw as AgentName)
    : "Harper";
}

const VALID_CATEGORIES: ThoughtCategory[] = [
  "standup",
  "news-response",
  "broadcast",
  "mention",
  "scheduled",
  "spontaneous",
];

function toCategory(raw: string): ThoughtCategory {
  return VALID_CATEGORIES.includes(raw as ThoughtCategory)
    ? (raw as ThoughtCategory)
    : "spontaneous";
}

/** Map a DB row to the application interface */
export function mapRowToThought(row: ThoughtBankRow): AgentThought {
  return {
    id: row.id,
    agent: toAgent(row.agent),
    category: toCategory(row.category),
    title: row.title,
    fullAnalysis: row.full_analysis,
    briefSummary: row.brief_summary,
    sessionId: row.session_id,
    boardroomMessageId: row.boardroom_message_id,
    contextSnapshotVersion: row.context_snapshot_version,
    instruments: row.instruments ?? [],
    confidence: row.confidence ?? 0.5,
    referencedThoughtIds: row.referenced_thought_ids ?? [],
    metadata: row.metadata ?? {},
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
  };
}
