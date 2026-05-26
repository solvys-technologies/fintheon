/**
 * Conversation Store Service
 * Persist AI chat conversations to database
 * Day 18 - Phase 5 Implementation
 */

import { sql, isDatabaseAvailable } from "../../config/database.js";
import type {
  Conversation,
  ConversationWithMessages,
  ChatMessage,
  ConversationRow,
  MessageRow,
  ConversationListItem,
  CreateConversationRequest,
  UpdateConversationRequest,
  mapRowToConversation,
  mapRowToMessage,
} from "../../types/ai-chat.js";

const isDev = process.env.NODE_ENV !== "production";
const MAX_HISTORY_MESSAGES = 50;
const STALE_AFTER_HOURS = 4;
const MAX_CONTEXT_TOKENS = 100_000;
const SUMMARIZATION_THRESHOLD = 80_000;
const VERBATIM_TAIL = 30;

/**
 * Estimate token count for a set of messages (~4 chars per token heuristic)
 */
export function estimateTokens(
  messages: { role: string; content: string }[],
): number {
  return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
}

/**
 * Summarize older messages via OpenCode Go when context exceeds threshold
 */
async function summarizeOlderMessages(
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<string | null> {
  const olderMessages = messages.slice(0, messages.length - VERBATIM_TAIL);
  if (olderMessages.length === 0) return null;

  const apiKey =
    process.env.OPENCODE_GO_API_KEY ||
    process.env.HERMES_API_KEY ||
    "opencode-go";
  const baseUrl = (
    process.env.HERMES_API_URL || "http://localhost:8081/v1"
  ).replace(/\/+$/, "");

  const summaryPrompt = `Summarize this conversation history concisely, preserving key facts, decisions, and context:\n\n${olderMessages.map((m) => `${m.role}: ${m.content}`).join("\n\n")}`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-reasoner",
        messages: [
          {
            role: "system",
            content:
              "You are a concise conversation summarizer. Preserve key facts, trade ideas, decisions, and numbers. Be brief.",
          },
          { role: "user", content: summaryPrompt },
        ],
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.warn("[ConversationStore] Summarization error:", response.status);
      return null;
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.warn(
      "[ConversationStore] Summarization failed, using full history:",
      err,
    );
    return null;
  }
}

// Cache summaries per conversation to avoid re-summarizing
const summaryCache = new Map<
  string,
  { summary: string; messageCount: number; expiresAt: number }
>();

// In-memory fallback for dev mode without database
const memoryStore = {
  conversations: new Map<string, Conversation>(),
  messages: new Map<string, ChatMessage[]>(),
};

/**
 * Create a new conversation
 */
export async function createConversation(
  userId: string,
  request: CreateConversationRequest = {},
): Promise<Conversation> {
  const title = request.title || "New conversation";
  const model = request.model || null;
  const threadId = request.threadId || null;
  const parentId = request.parentId || null;
  const metadata = request.metadata || {};

  if (!isDatabaseAvailable() || !sql) {
    // In-memory fallback for dev
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id,
      userId,
      title,
      model: model ?? undefined,
      threadId: threadId ?? undefined,
      parentId: parentId ?? undefined,
      metadata,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    memoryStore.conversations.set(id, conversation);
    memoryStore.messages.set(id, []);
    return conversation;
  }

  const result = await sql`
    INSERT INTO ai_conversations (user_id, title, model, thread_id, parent_id, metadata)
    VALUES (${userId}, ${title}, ${model}, ${threadId}, ${parentId}, ${JSON.stringify(metadata)})
    RETURNING *
  `;

  const row = result[0] as ConversationRow;
  return mapConversationRow(row);
}

/**
 * Get conversation by ID
 */
export async function getConversation(
  conversationId: string,
  userId: string,
): Promise<Conversation | null> {
  // Validate UUID format (conversation IDs are UUIDs)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(conversationId)) {
    console.warn(`[Conversations] Invalid UUID format: ${conversationId}`);
    return null;
  }

  if (!isDatabaseAvailable() || !sql) {
    const conv = memoryStore.conversations.get(conversationId);
    if (conv && conv.userId === userId) return conv;
    return null;
  }

  const result = await sql`
    SELECT * FROM ai_conversations
    WHERE id = ${conversationId} AND user_id = ${userId}
    LIMIT 1
  `;

  if (result.length === 0) return null;
  return mapConversationRow(result[0] as ConversationRow);
}

/**
 * Get conversation with all messages
 */
export async function getConversationWithMessages(
  conversationId: string,
  userId: string,
): Promise<ConversationWithMessages | null> {
  const conversation = await getConversation(conversationId, userId);
  if (!conversation) return null;

  const messages = await getMessages(conversationId);

  return { ...conversation, messages };
}

/**
 * List conversations for a user
 */
export async function listConversations(
  userId: string,
  options: {
    limit?: number;
    cursor?: string;
    includeArchived?: boolean;
    workspaceId?: string;
    surface?: string;
  } = {},
): Promise<{ conversations: ConversationListItem[]; hasMore: boolean }> {
  const limit = options.limit ?? 20;
  const includeArchived = options.includeArchived ?? false;
  const workspaceId = options.workspaceId?.trim();
  const surface = options.surface?.trim();

  if (!isDatabaseAvailable() || !sql) {
    // In-memory fallback
    const all = Array.from(memoryStore.conversations.values())
      .filter((c) => c.userId === userId)
      .filter((c) => includeArchived || !c.isArchived)
      .filter((c) => matchesConversationScope(c.metadata, workspaceId, surface))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

    const items: ConversationListItem[] = all.slice(0, limit).map((c) => ({
      id: c.id,
      title: c.title,
      model: c.model,
      metadata: c.metadata,
      messageCount: memoryStore.messages.get(c.id)?.length ?? 0,
      lastMessageAt: c.updatedAt,
      isArchived: c.isArchived,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return { conversations: items, hasMore: all.length > limit };
  }

  let result: Record<string, unknown>[];

  if (workspaceId && surface) {
    result = includeArchived
      ? await sql`
        SELECT c.*, COUNT(m.id) as message_count, MAX(m.created_at) as last_message_at
        FROM ai_conversations c
        LEFT JOIN ai_messages m ON m.conversation_id = c.id
        WHERE c.user_id = ${userId}
          AND c.metadata->'workspace'->>'id' = ${workspaceId}
          AND c.metadata->>'surface' = ${surface}
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        LIMIT ${limit + 1}
      `
      : await sql`
        SELECT c.*, COUNT(m.id) as message_count, MAX(m.created_at) as last_message_at
        FROM ai_conversations c
        LEFT JOIN ai_messages m ON m.conversation_id = c.id
        WHERE c.user_id = ${userId}
          AND (c.is_archived = false OR c.is_archived IS NULL)
          AND c.metadata->'workspace'->>'id' = ${workspaceId}
          AND c.metadata->>'surface' = ${surface}
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        LIMIT ${limit + 1}
      `;
  } else if (workspaceId) {
    result = includeArchived
      ? await sql`
        SELECT c.*, COUNT(m.id) as message_count, MAX(m.created_at) as last_message_at
        FROM ai_conversations c
        LEFT JOIN ai_messages m ON m.conversation_id = c.id
        WHERE c.user_id = ${userId}
          AND c.metadata->'workspace'->>'id' = ${workspaceId}
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        LIMIT ${limit + 1}
      `
      : await sql`
        SELECT c.*, COUNT(m.id) as message_count, MAX(m.created_at) as last_message_at
        FROM ai_conversations c
        LEFT JOIN ai_messages m ON m.conversation_id = c.id
        WHERE c.user_id = ${userId}
          AND (c.is_archived = false OR c.is_archived IS NULL)
          AND c.metadata->'workspace'->>'id' = ${workspaceId}
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        LIMIT ${limit + 1}
      `;
  } else {
    // Use SQL condition directly - Neon doesn't support template fragment interpolation
    result = includeArchived
      ? await sql`
        SELECT c.*, COUNT(m.id) as message_count, MAX(m.created_at) as last_message_at
        FROM ai_conversations c
        LEFT JOIN ai_messages m ON m.conversation_id = c.id
        WHERE c.user_id = ${userId}
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        LIMIT ${limit + 1}
      `
      : await sql`
        SELECT c.*, COUNT(m.id) as message_count, MAX(m.created_at) as last_message_at
        FROM ai_conversations c
        LEFT JOIN ai_messages m ON m.conversation_id = c.id
        WHERE c.user_id = ${userId} AND (c.is_archived = false OR c.is_archived IS NULL)
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        LIMIT ${limit + 1}
      `;
  }

  const hasMore = result.length > limit;
  const rows = result.slice(0, limit);

  const conversations: ConversationListItem[] = rows.map(
    (row: Record<string, unknown>) => ({
      id: String(row.id),
      title: String(row.title ?? "Untitled"),
      model: row.model ? String(row.model) : undefined,
      metadata: isRecord(row.metadata) ? row.metadata : undefined,
      messageCount: Number(row.message_count ?? 0),
      lastMessageAt: String(row.last_message_at ?? row.updated_at),
      isArchived: Boolean(row.is_archived),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }),
  );

  return { conversations, hasMore };
}

function matchesConversationScope(
  metadata: Record<string, unknown> | undefined,
  workspaceId: string | undefined,
  surface: string | undefined,
): boolean {
  if (!workspaceId && !surface) return true;
  if (!metadata) return false;
  const workspace = metadata.workspace;
  const metadataWorkspaceId = isRecord(workspace)
    ? String(workspace.id ?? "")
    : "";
  const metadataSurface = String(metadata.surface ?? "");
  if (workspaceId && metadataWorkspaceId !== workspaceId) return false;
  if (surface && metadataSurface !== surface) return false;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/**
 * Update a conversation
 */
export async function updateConversation(
  conversationId: string,
  userId: string,
  updates: UpdateConversationRequest,
): Promise<Conversation | null> {
  if (!isDatabaseAvailable() || !sql) {
    const conv = memoryStore.conversations.get(conversationId);
    if (!conv || conv.userId !== userId) return null;

    const updated: Conversation = {
      ...conv,
      title: updates.title ?? conv.title,
      isArchived: updates.isArchived ?? conv.isArchived,
      metadata: updates.metadata ?? conv.metadata,
      updatedAt: new Date().toISOString(),
    };
    memoryStore.conversations.set(conversationId, updated);
    return updated;
  }

  const result = await sql`
    UPDATE ai_conversations SET
      title = COALESCE(${updates.title ?? null}, title),
      is_archived = COALESCE(${updates.isArchived ?? null}, is_archived),
      metadata = COALESCE(${updates.metadata ? JSON.stringify(updates.metadata) : null}::jsonb, metadata),
      updated_at = NOW()
    WHERE id = ${conversationId} AND user_id = ${userId}
    RETURNING *
  `;

  if (result.length === 0) return null;
  return mapConversationRow(result[0] as ConversationRow);
}

/**
 * Reassign a conversation's owner. Used by the hydration endpoint to migrate
 * legacy anonymous convos onto an authenticated user's sub on first access,
 * so that downstream ownership-gated endpoints (relay dispatch, delete, etc.)
 * stop returning 404 for convos that showed up in the user's chat history.
 *
 * [claude-code 2026-04-18] Added to resolve the hydration/dispatch ownership
 * mismatch discovered after the 2026-04-18 chat history migration: 98 legacy
 * anon conversations were reassigned to TP's sub in bulk, but any anon convo
 * created AFTER the migration (or missed by the migration) still falls back
 * to the anonymous branch in handleGetConversation — hydration succeeds,
 * dispatch returns not_found, user sees a broken relay button.
 */
export async function reassignConversationOwner(
  conversationId: string,
  fromUserId: string,
  toUserId: string,
): Promise<boolean> {
  if (!isDatabaseAvailable() || !sql) {
    const conv = memoryStore.conversations.get(conversationId);
    if (!conv || conv.userId !== fromUserId) return false;
    memoryStore.conversations.set(conversationId, {
      ...conv,
      userId: toUserId,
      updatedAt: new Date().toISOString(),
    });
    return true;
  }

  const result = await sql`
    UPDATE ai_conversations
    SET user_id = ${toUserId}, updated_at = NOW()
    WHERE id = ${conversationId} AND user_id = ${fromUserId}
    RETURNING id
  `;

  return result.length > 0;
}

/**
 * Delete a conversation and its messages
 */
export async function deleteConversation(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  if (!isDatabaseAvailable() || !sql) {
    const conv = memoryStore.conversations.get(conversationId);
    if (!conv || conv.userId !== userId) return false;
    memoryStore.conversations.delete(conversationId);
    memoryStore.messages.delete(conversationId);
    return true;
  }

  const result = await sql`
    DELETE FROM ai_conversations
    WHERE id = ${conversationId} AND user_id = ${userId}
    RETURNING id
  `;

  return result.length > 0;
}

/**
 * Add a message to a conversation
 */
export async function addMessage(
  conversationId: string,
  message: Omit<ChatMessage, "id" | "createdAt">,
): Promise<ChatMessage> {
  if (!isDatabaseAvailable() || !sql) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newMessage: ChatMessage = {
      ...message,
      id,
      createdAt: now,
    };
    const messages = memoryStore.messages.get(conversationId) ?? [];
    messages.push(newMessage);
    memoryStore.messages.set(conversationId, messages);
    return newMessage;
  }

  const result = await sql`
    INSERT INTO ai_messages (
      conversation_id, user_id, role, content, model,
      input_tokens, output_tokens, total_tokens, cost_usd, metadata
    )
    VALUES (
      ${conversationId},
      (SELECT user_id FROM ai_conversations WHERE id = ${conversationId}),
      ${message.role}, ${message.content}, ${message.model ?? null},
      ${message.inputTokens ?? null}, ${message.outputTokens ?? null},
      ${message.totalTokens ?? null}, ${message.costUsd ?? null},
      ${message.metadata ? JSON.stringify(message.metadata) : null}
    )
    RETURNING *
  `;

  // Update conversation timestamp
  await sql`
    UPDATE ai_conversations SET updated_at = NOW()
    WHERE id = ${conversationId}
  `;

  return mapMessageRow(result[0] as MessageRow);
}

/**
 * Get messages for a conversation
 */
export async function getMessages(
  conversationId: string,
  limit?: number,
): Promise<ChatMessage[]> {
  if (!isDatabaseAvailable() || !sql) {
    const messages = memoryStore.messages.get(conversationId) ?? [];
    return limit ? messages.slice(-limit) : messages;
  }

  const messageLimit = limit ?? MAX_HISTORY_MESSAGES;

  const result = await sql`
    SELECT * FROM ai_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at DESC
    LIMIT ${messageLimit}
  `;

  // Reverse to get chronological order
  return result.reverse().map((row) => mapMessageRow(row as MessageRow));
}

/**
 * Get recent messages for context (for AI)
 * Auto-summarizes older messages when token count exceeds threshold
 */
export async function getRecentContext(
  conversationId: string,
): Promise<{ role: "user" | "assistant" | "system"; content: string }[]> {
  const messages = await getMessages(conversationId, MAX_HISTORY_MESSAGES);

  const filtered = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const tokenEstimate = estimateTokens(filtered);

  // Auto-summarize when context is large
  if (
    tokenEstimate > SUMMARIZATION_THRESHOLD &&
    filtered.length > VERBATIM_TAIL
  ) {
    // Check cache first
    const cached = summaryCache.get(conversationId);
    if (
      cached &&
      cached.messageCount === filtered.length &&
      cached.expiresAt > Date.now()
    ) {
      const verbatim = filtered.slice(-VERBATIM_TAIL);
      return [
        {
          role: "system" as const,
          content: `[Conversation summary]\n${cached.summary}`,
        },
        ...verbatim,
      ];
    }

    console.log(
      `[ConversationStore] Summarizing ${filtered.length} messages (${tokenEstimate} est. tokens)`,
    );
    const summary = await summarizeOlderMessages(filtered);

    if (summary) {
      // Cache for 5 minutes
      summaryCache.set(conversationId, {
        summary,
        messageCount: filtered.length,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      const verbatim = filtered.slice(-VERBATIM_TAIL);
      return [
        {
          role: "system" as const,
          content: `[Conversation summary]\n${summary}`,
        },
        ...verbatim,
      ];
    }
  }

  return filtered;
}

/**
 * Generate conversation title from first message
 */
export function generateTitle(firstMessage: string): string {
  // Take first 50 chars, trim to word boundary
  const maxLength = 50;
  if (firstMessage.length <= maxLength) return firstMessage;

  const trimmed = firstMessage.substring(0, maxLength);
  const lastSpace = trimmed.lastIndexOf(" ");
  return (lastSpace > 20 ? trimmed.substring(0, lastSpace) : trimmed) + "...";
}

// Helper: Map database row to Conversation
function mapConversationRow(row: ConversationRow): Conversation {
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

// Helper: Map database row to ChatMessage
function mapMessageRow(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as "user" | "assistant" | "system",
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
