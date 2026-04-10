/**
 * AI Chat Types
 * Type definitions for AI chat functionality
 * Day 18 - Phase 5 Implementation
 */

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  model?: string;
  threadId?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
  isArchived: boolean;
  staleAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: ChatMessage[];
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  model?: string;
  taskType?: string;
  /**
   * Force routing to a specific Hermes agent for this chat thread.
   * This is used by per-agent chat UIs to keep analyst threads consistent.
   */
  agentOverride?: string;
  streamEnabled?: boolean;
}

export interface ChatResponse {
  id: string;
  conversationId: string;
  role: "assistant";
  content: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  createdAt: string;
}

export interface ConversationListItem {
  id: string;
  title: string;
  model?: string;
  messageCount: number;
  lastMessageAt: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationListResponse {
  conversations: ConversationListItem[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface CreateConversationRequest {
  title?: string;
  model?: string;
  threadId?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateConversationRequest {
  title?: string;
  isArchived?: boolean;
  metadata?: Record<string, unknown>;
}

// Database row types (snake_case)
export interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  model: string | null;
  thread_id: string | null;
  parent_id: string | null;
  metadata: Record<string, unknown> | null;
  is_archived: boolean;
  stale_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Conversion utilities
export function mapRowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title ?? "Untitled",
    model: row.model ?? undefined,
    threadId: row.thread_id ?? undefined,
    parentId: row.parent_id ?? undefined,
    metadata: row.metadata ?? undefined,
    isArchived: Boolean(row.is_archived),
    staleAt: row.stale_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRowToMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as MessageRole,
    content: row.content,
    model: row.model ?? undefined,
    inputTokens: row.input_tokens ?? undefined,
    outputTokens: row.output_tokens ?? undefined,
    totalTokens: row.total_tokens ?? undefined,
    costUsd: row.cost_usd ? Number(row.cost_usd) : undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
  };
}
