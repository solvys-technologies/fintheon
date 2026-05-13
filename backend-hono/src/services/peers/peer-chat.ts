// [claude-code 2026-05-13] S63 pre-deploy: peer-chat service created (pre-existing build gap, unblocks deploy)
// Agent-to-agent structured messaging protocol for Claude Peers.
// Messages stored in shared-memory under "peer-chat" category,
// keyed by conversationId.

import { createLogger } from "../../lib/logger.js";
import {
  setSharedMemory,
  getSharedMemory,
  listSharedMemory,
} from "./shared-memory.js";
import type { PeerChatMessage, PeerConversation } from "../../types/peers.js";

const log = createLogger("PeerChat");

const STORE_CATEGORY = "peer-chat";
const TTL_HOURS = 24;

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function messagesKey(conversationId: string): string {
  return `messages:${conversationId}`;
}

export async function sendMessage(params: {
  senderPeerId: string;
  senderAgentName: string;
  recipientPeerId: string;
  recipientAgentName: string;
  type: string;
  role: string;
  body: string;
  payload?: Record<string, unknown>;
  conversationId?: string;
  inReplyTo?: string;
}): Promise<{ message: PeerChatMessage | null; error?: string }> {
  try {
    const conversationId = params.conversationId ?? generateConversationId();
    const clock = Date.now();

    const message: PeerChatMessage = {
      id: generateId(),
      conversationId,
      senderPeerId: params.senderPeerId,
      senderAgentName: params.senderAgentName,
      recipientPeerId: params.recipientPeerId,
      recipientAgentName: params.recipientAgentName,
      type: params.type as PeerChatMessage["type"],
      role: params.role as PeerChatMessage["role"],
      body: params.body,
      payload: params.payload,
      inReplyTo: params.inReplyTo,
      read: false,
      createdAt: new Date(clock).toISOString(),
    };

    // Persist message to the conversation
    const msgKey = messagesKey(conversationId);
    const existingEntry = await getSharedMemory(msgKey);
    let existing: PeerChatMessage[] = [];
    if (existingEntry?.value) {
      const val = existingEntry.value as Record<string, unknown>;
      if (Array.isArray(val.messages))
        existing = val.messages as PeerChatMessage[];
    }
    existing.push(message);

    await setSharedMemory(
      msgKey,
      { messages: existing },
      {
        peerId: params.senderPeerId,
        agentName: params.senderAgentName,
        category: STORE_CATEGORY,
        ttlHours: TTL_HOURS,
      },
    );

    // Upsert conversation metadata
    const convKey = `conversation:${conversationId}`;
    const convEntry = await getSharedMemory(convKey);
    let conversation: PeerConversation;
    if (convEntry?.value) {
      conversation = convEntry.value as unknown as PeerConversation;
      conversation.lastActivityAt = new Date(clock).toISOString();
    } else {
      conversation = {
        id: conversationId,
        title: `Chat ${conversationId.slice(-6)}`,
        participantPeerIds: [params.senderPeerId, params.recipientPeerId],
        participantAgentNames: [
          params.senderAgentName,
          params.recipientAgentName,
        ],
        lastActivityAt: new Date(clock).toISOString(),
        unreadByPeer: {},
        createdAt: new Date(clock).toISOString(),
      };
    }

    await setSharedMemory(
      convKey,
      conversation as unknown as Record<string, unknown>,
      {
        peerId: params.senderPeerId,
        agentName: params.senderAgentName,
        category: STORE_CATEGORY,
        ttlHours: TTL_HOURS,
      },
    );

    return { message };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error("Failed to send message", { error: msg });
    return { message: null, error: msg };
  }
}

export async function listConversations(
  _peerId: string,
  limit = 50,
): Promise<{ conversations: PeerConversation[]; total: number }> {
  try {
    const entries = await listSharedMemory({ category: STORE_CATEGORY });
    const conversations: PeerConversation[] = [];

    for (const entry of entries) {
      if (!entry.key.startsWith("conversation:") || !entry.value) continue;
      try {
        conversations.push(entry.value as unknown as PeerConversation);
      } catch {
        // skip malformed
      }
    }

    conversations.sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() -
        new Date(a.lastActivityAt).getTime(),
    );

    return {
      conversations: conversations.slice(0, limit),
      total: conversations.length,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error("Failed to list conversations", { error: msg });
    return { conversations: [], total: 0 };
  }
}

export async function getMessages(
  conversationId: string,
  opts?: { since?: string; limit?: number },
): Promise<{
  messages: PeerChatMessage[];
  total: number;
  conversationId: string;
}> {
  try {
    const entry = await getSharedMemory(messagesKey(conversationId));
    if (!entry?.value) return { messages: [], total: 0, conversationId };

    const val = entry.value as Record<string, unknown>;
    let all: PeerChatMessage[] = (val.messages as PeerChatMessage[]) ?? [];

    if (opts?.since) {
      const sinceMs = new Date(opts.since).getTime();
      all = all.filter((m) => new Date(m.createdAt).getTime() > sinceMs);
    }

    const limited = opts?.limit ? all.slice(-opts.limit) : all;

    return {
      messages: limited,
      total: all.length,
      conversationId,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error("Failed to get messages", { error: msg, conversationId });
    return { messages: [], total: 0, conversationId };
  }
}

export async function markAsRead(
  conversationId: string,
  peerId: string,
): Promise<boolean> {
  try {
    await setSharedMemory(
      `read:${conversationId}:${peerId}`,
      { readAt: new Date().toISOString(), peerId },
      { category: STORE_CATEGORY, ttlHours: TTL_HOURS },
    );
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error("Failed to mark as read", { error: msg, conversationId, peerId });
    return false;
  }
}

export async function getUnreadCount(peerId: string): Promise<number> {
  try {
    const entries = await listSharedMemory({ category: STORE_CATEGORY });
    return entries.filter(
      (e) => e.key.startsWith("conversation:") && !e.key.includes(peerId),
    ).length;
  } catch {
    return 0;
  }
}

export async function findOrCreateConversation(params: {
  participantPeerIds: string[];
  participantAgentNames: string[];
  title?: string;
}): Promise<{ conversation: PeerConversation }> {
  const clock = Date.now();
  const conversation: PeerConversation = {
    id: generateConversationId(),
    title: params.title ?? `${params.participantAgentNames.join(" + ")} chat`,
    participantPeerIds: params.participantPeerIds,
    participantAgentNames: params.participantAgentNames,
    lastActivityAt: new Date(clock).toISOString(),
    unreadByPeer: {},
    createdAt: new Date(clock).toISOString(),
  };

  await setSharedMemory(
    `conversation:${conversation.id}`,
    conversation as unknown as Record<string, unknown>,
    {
      peerId: params.participantPeerIds[0],
      category: STORE_CATEGORY,
      ttlHours: TTL_HOURS,
    },
  );

  return { conversation };
}
