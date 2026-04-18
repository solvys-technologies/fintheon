/**
 * Conversations Handler
 * Handle conversation CRUD operations
 * Day 19 - Phase 5 Implementation
 */

// [claude-code 2026-04-18] Anon-convo hydration now auto-reassigns to the authed user. The
// anonymous fallback in handleGetConversation was masking ownership mismatches — convos
// showed up in chat history fine but /api/relay/dispatch (strict ownership) returned 404,
// breaking the relay button for any convo missed by the 2026-04-18 migration or created
// as anon after it. Reassigning on first authed access aligns hydration + dispatch.
import type { Context } from "hono";
import * as conversationStore from "../../../services/ai/conversation-store.js";
import type {
  CreateConversationRequest,
  UpdateConversationRequest,
  ConversationListResponse,
} from "../../../types/ai-chat.js";

/**
 * GET /api/ai/conversations
 * List all conversations for user
 */
export async function handleListConversations(c: Context) {
  const userId = (c.get("userId") as string | undefined) || "anonymous";

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

/**
 * GET /api/ai/conversations/:id
 * Get a single conversation with messages
 */
export async function handleGetConversation(c: Context) {
  const userId = (c.get("userId") as string | undefined) || "anonymous";

  const conversationId = c.req.param("id");

  if (!conversationId) {
    return c.json({ error: "Conversation ID is required" }, 400);
  }

  try {
    // Try authenticated userId first, fall back to "anonymous" for legacy conversations.
    // If the fallback succeeds for an authed user, reassign ownership on the spot so that
    // subsequent ownership-gated endpoints (relay dispatch, delete, etc.) succeed instead
    // of returning 404. This is a no-op for unauthed callers (userId === "anonymous").
    let conversation = await conversationStore.getConversationWithMessages(
      conversationId,
      userId,
    );
    if (!conversation && userId !== "anonymous") {
      conversation = await conversationStore.getConversationWithMessages(
        conversationId,
        "anonymous",
      );
      if (conversation) {
        const reassigned = await conversationStore
          .reassignConversationOwner(conversationId, "anonymous", userId)
          .catch((err) => {
            console.warn(
              "[Conversations] Anon-to-user reassign failed (non-fatal):",
              err,
            );
            return false;
          });
        if (reassigned) {
          console.info(
            `[Conversations] Reassigned legacy anon convo ${conversationId} to ${userId}`,
          );
        }
      }
    }

    if (!conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    return c.json(conversation);
  } catch (error) {
    console.error("[Conversations] Get error:", error);
    return c.json({ error: "Failed to get conversation" }, 500);
  }
}

/**
 * POST /api/ai/conversations
 * Create a new conversation
 */
export async function handleCreateConversation(c: Context) {
  const userId = (c.get("userId") as string | undefined) || "anonymous";

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

/**
 * PATCH /api/ai/conversations/:id
 * Update a conversation
 */
export async function handleUpdateConversation(c: Context) {
  const userId = (c.get("userId") as string | undefined) || "anonymous";

  const conversationId = c.req.param("id");

  if (!conversationId) {
    return c.json({ error: "Conversation ID is required" }, 400);
  }

  try {
    const body = await c.req
      .json<UpdateConversationRequest>()
      .catch(() => null);

    // Validate body and at least one field to update
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

/**
 * DELETE /api/ai/conversations/:id
 * Delete a conversation
 */
export async function handleDeleteConversation(c: Context) {
  const userId = (c.get("userId") as string | undefined) || "anonymous";

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

/**
 * POST /api/ai/conversations/:id/archive
 * Archive a conversation
 */
export async function handleArchiveConversation(c: Context) {
  const userId = (c.get("userId") as string | undefined) || "anonymous";

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

/**
 * POST /api/ai/conversations/:id/unarchive
 * Unarchive a conversation
 */
export async function handleUnarchiveConversation(c: Context) {
  const userId = (c.get("userId") as string | undefined) || "anonymous";

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
