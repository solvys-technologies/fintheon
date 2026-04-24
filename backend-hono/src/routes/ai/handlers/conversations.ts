/**
 * Conversations Handler — CRUD for ai_conversations + ai_messages.
 *
 * All handlers require a verified userId. An unauthed caller gets 401, never
 * a "anonymous" row lookup. The prior behavior returned any conversation
 * whose id happened to live under the literal userId "anonymous" and then
 * silently reassigned that row to the caller — that combination is an ACL
 * bypass, so both the fallback lookup and the reassign helper are removed.
 */
import type { Context } from "hono";
import * as conversationStore from "../../../services/ai/conversation-store.js";
import type {
  CreateConversationRequest,
  UpdateConversationRequest,
  ConversationListResponse,
} from "../../../types/ai-chat.js";

const AUTH_REQUIRED = {
  error: "Authentication required",
  hint: "Sign in via Supabase before calling /api/ai/conversations.",
} as const;

function resolveUserId(c: Context): string | null {
  const uid = c.get("userId") as string | undefined;
  if (!uid || uid === "anonymous") return null;
  return uid;
}

/** GET /api/ai/conversations */
export async function handleListConversations(c: Context) {
  const userId = resolveUserId(c);
  if (!userId) return c.json(AUTH_REQUIRED, 401);

  try {
    const limit = parseInt(c.req.query("limit") ?? "20", 10);
    const cursor = c.req.query("cursor");
    const includeArchived = c.req.query("archived") === "true";

    const { conversations, hasMore } =
      await conversationStore.listConversations(userId, {
        limit,
        cursor,
        includeArchived,
      });

    const response: ConversationListResponse = {
      conversations,
      total: conversations.length,
      hasMore,
      nextCursor:
        hasMore && conversations.length > 0
          ? conversations[conversations.length - 1].id
          : undefined,
    };

    return c.json(response);
  } catch (error) {
    console.error("[Conversations] List error:", error);
    return c.json({ error: "Failed to list conversations" }, 500);
  }
}

/** GET /api/ai/conversations/:id — owner-only, no anon fallback. */
export async function handleGetConversation(c: Context) {
  const userId = resolveUserId(c);
  if (!userId) return c.json(AUTH_REQUIRED, 401);

  const conversationId = c.req.param("id");
  if (!conversationId) {
    return c.json({ error: "Conversation ID is required" }, 400);
  }

  try {
    const conversation = await conversationStore.getConversationWithMessages(
      conversationId,
      userId,
    );
    if (!conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }
    return c.json(conversation);
  } catch (error) {
    console.error("[Conversations] Get error:", error);
    return c.json({ error: "Failed to get conversation" }, 500);
  }
}

/** POST /api/ai/conversations */
export async function handleCreateConversation(c: Context) {
  const userId = resolveUserId(c);
  if (!userId) return c.json(AUTH_REQUIRED, 401);

  try {
    const body = await c.req
      .json<CreateConversationRequest>()
      .catch(() => ({}));

    const conversation = await conversationStore.createConversation(
      userId,
      body,
    );

    return c.json(conversation, 201);
  } catch (error) {
    console.error("[Conversations] Create error:", error);
    return c.json({ error: "Failed to create conversation" }, 500);
  }
}

/** PATCH /api/ai/conversations/:id */
export async function handleUpdateConversation(c: Context) {
  const userId = resolveUserId(c);
  if (!userId) return c.json(AUTH_REQUIRED, 401);

  const conversationId = c.req.param("id");
  if (!conversationId) {
    return c.json({ error: "Conversation ID is required" }, 400);
  }

  try {
    const body = await c.req
      .json<UpdateConversationRequest>()
      .catch(() => null);

    if (
      !body ||
      (body.title === undefined &&
        body.isArchived === undefined &&
        body.metadata === undefined)
    ) {
      return c.json({ error: "No fields to update" }, 400);
    }

    const conversation = await conversationStore.updateConversation(
      conversationId,
      userId,
      body,
    );

    if (!conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    return c.json(conversation);
  } catch (error) {
    console.error("[Conversations] Update error:", error);
    return c.json({ error: "Failed to update conversation" }, 500);
  }
}

/** DELETE /api/ai/conversations/:id */
export async function handleDeleteConversation(c: Context) {
  const userId = resolveUserId(c);
  if (!userId) return c.json(AUTH_REQUIRED, 401);

  const conversationId = c.req.param("id");
  if (!conversationId) {
    return c.json({ error: "Conversation ID is required" }, 400);
  }

  try {
    const deleted = await conversationStore.deleteConversation(
      conversationId,
      userId,
    );

    if (!deleted) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    return c.json({ success: true, message: "Conversation deleted" });
  } catch (error) {
    console.error("[Conversations] Delete error:", error);
    return c.json({ error: "Failed to delete conversation" }, 500);
  }
}

/** POST /api/ai/conversations/:id/archive */
export async function handleArchiveConversation(c: Context) {
  const userId = resolveUserId(c);
  if (!userId) return c.json(AUTH_REQUIRED, 401);

  const conversationId = c.req.param("id");
  if (!conversationId) {
    return c.json({ error: "Conversation ID is required" }, 400);
  }

  try {
    const conversation = await conversationStore.updateConversation(
      conversationId,
      userId,
      { isArchived: true },
    );

    if (!conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    return c.json(conversation);
  } catch (error) {
    console.error("[Conversations] Archive error:", error);
    return c.json({ error: "Failed to archive conversation" }, 500);
  }
}

/** POST /api/ai/conversations/:id/unarchive */
export async function handleUnarchiveConversation(c: Context) {
  const userId = resolveUserId(c);
  if (!userId) return c.json(AUTH_REQUIRED, 401);

  const conversationId = c.req.param("id");
  if (!conversationId) {
    return c.json({ error: "Conversation ID is required" }, 400);
  }

  try {
    const conversation = await conversationStore.updateConversation(
      conversationId,
      userId,
      { isArchived: false },
    );

    if (!conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    return c.json(conversation);
  } catch (error) {
    console.error("[Conversations] Unarchive error:", error);
    return c.json({ error: "Failed to unarchive conversation" }, 500);
  }
}
