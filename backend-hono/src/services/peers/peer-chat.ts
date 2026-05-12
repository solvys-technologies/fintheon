// [claude-code 2026-05-12] Peer-chat service — agent-to-agent messaging protocol
// Builds on peer-registry (for peer lookup) and shared-memory (for persistence).

import { createLogger } from "../../lib/logger.js";
import {
  getSharedMemory,
  listSharedMemory,
  setSharedMemory,
} from "./shared-memory.js";
import { getPeer } from "./peer-registry.js";
import type {
  PeerChatMessage,
  PeerChatMessageType,
  PeerConversation,
  PeerMessageRole,
} from "../../types/peers.js";

const log = createLogger("PeerChat");
const CONVERSATION_INDEX_KEY = "peer-chat:conversation-index";

// TTL: messages live 7 days, conversations live 30 days
const MESSAGE_TTL_HOURS = 7 * 24;
const CONVERSATION_TTL_HOURS = 30 * 24;

// ── Internal helpers ─────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function conversationMessageKey(conversationId: string): string {
  return `peer-chat:conversation:${conversationId}`;
}

function conversationMetaKey(conversationId: string): string {
  return `peer-chat:meta:${conversationId}`;
}

/** Load a conversation's message array from shared memory */
async function loadMessages(
  conversationId: string,
): Promise<PeerChatMessage[]> {
  const entry = await getSharedMemory(conversationMessageKey(conversationId));
  if (!entry) return [];
  const msgs = entry.value?.messages;
  return Array.isArray(msgs) ? (msgs as PeerChatMessage[]) : [];
}

/** Save a conversation's message array (upserts full array — fine for low-frequency agent traffic) */
async function saveMessages(
  conversationId: string,
  messages: PeerChatMessage[],
): Promise<void> {
  await setSharedMemory(
    conversationMessageKey(conversationId),
    { messages },
    { category: "peer-chat", ttlHours: MESSAGE_TTL_HOURS },
  );
}

/** Load conversation metadata */
async function loadConversation(
  conversationId: string,
): Promise<PeerConversation | null> {
  const entry = await getSharedMemory(conversationMetaKey(conversationId));
  if (!entry) return null;
  return (entry.value as unknown as PeerConversation) ?? null;
}

/** Save conversation metadata */
async function saveConversation(conv: PeerConversation): Promise<void> {
  await setSharedMemory(
    conversationMetaKey(conv.id),
    conv as unknown as Record<string, unknown>,
    { category: "peer-chat", ttlHours: CONVERSATION_TTL_HOURS },
  );
}

/** Load the conversation index (list of conversation IDs for a peer) */
async function loadConversationIndex(peerId: string): Promise<string[]> {
  const entry = await getSharedMemory(`peer-chat:index:${peerId}`);
  return (entry?.value?.conversationIds as string[]) ?? [];
}

/** Save the conversation index for a peer */
async function saveConversationIndex(
  peerId: string,
  conversationIds: string[],
): Promise<void> {
  await setSharedMemory(
    `peer-chat:index:${peerId}`,
    { conversationIds },
    { category: "peer-chat", ttlHours: CONVERSATION_TTL_HOURS },
  );
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a message from one peer's agent to another.
 * Creates or appends to a conversation thread.
 */
export async function sendMessage(params: {
  senderPeerId: string;
  senderAgentName: string;
  recipientPeerId: string;
  recipientAgentName: string;
  type: PeerChatMessageType;
  role: PeerMessageRole;
  body: string;
  payload?: Record<string, unknown>;
  conversationId?: string;
  inReplyTo?: string;
}): Promise<{
  message: PeerChatMessage;
  conversation: PeerConversation;
  isNewConversation: boolean;
}> {
  const {
    senderPeerId,
    senderAgentName,
    recipientPeerId,
    recipientAgentName,
    type,
    role,
    body,
    payload,
    conversationId: existingConvId,
    inReplyTo,
  } = params;

  let conversation: PeerConversation | null = null;
  let isNewConversation = false;

  if (existingConvId) {
    conversation = await loadConversation(existingConvId);
  }

  if (!conversation) {
    // Gather participant peer info for the title
    const senderPeer = await getPeer(senderPeerId);
    const recipientPeer =
      recipientPeerId === "*" ? null : await getPeer(recipientPeerId);

    const convId = existingConvId ?? crypto.randomUUID();
    const participants = [senderPeerId];
    const agentNames = [senderAgentName];
    if (recipientPeerId !== senderPeerId) {
      participants.push(recipientPeerId);
    }
    if (recipientAgentName !== senderAgentName) {
      agentNames.push(recipientAgentName);
    }

    conversation = {
      id: convId,
      title: `${senderPeer?.deviceName ?? senderAgentName} → ${recipientPeer?.deviceName ?? recipientAgentName}`,
      participantPeerIds: participants,
      participantAgentNames: agentNames,
      lastActivityAt: nowIso(),
      unreadByPeer: {},
      createdAt: nowIso(),
    };
    isNewConversation = true;
  }

  // Build the message
  const message: PeerChatMessage = {
    id: crypto.randomUUID(),
    conversationId: conversation.id,
    senderPeerId,
    senderAgentName,
    recipientPeerId,
    recipientAgentName,
    type,
    role: role ?? "agent",
    body,
    payload: payload ?? undefined,
    inReplyTo: inReplyTo ?? undefined,
    read: false,
    createdAt: nowIso(),
  };

  // Append to conversation
  const messages = await loadMessages(conversation.id);
  messages.push(message);
  await saveMessages(conversation.id, messages);

  // Update conversation metadata
  conversation.lastActivityAt = message.createdAt;
  // Increment unread for all other participants
  for (const pid of conversation.participantPeerIds) {
    if (pid !== senderPeerId) {
      conversation.unreadByPeer[pid] =
        (conversation.unreadByPeer[pid] ?? 0) + 1;
    }
  }
  await saveConversation(conversation);

  // Update conversation index for all participants
  for (const pid of conversation.participantPeerIds) {
    const index = await loadConversationIndex(pid);
    if (!index.includes(conversation.id)) {
      index.unshift(conversation.id);
      await saveConversationIndex(pid, index);
    }
  }

  log.info("Message sent", {
    conversationId: conversation.id,
    type,
    from: `${senderAgentName}@${senderPeerId.slice(0, 8)}`,
    to: `${recipientAgentName}@${recipientPeerId.slice(0, 8)}`,
    bodyPreview: body.slice(0, 80),
    isNew: isNewConversation,
  });

  return { message, conversation, isNewConversation };
}

/**
 * List conversations for a peer, sorted by most recent activity.
 */
export async function listConversations(
  peerId: string,
  limit = 50,
): Promise<{
  conversations: PeerConversation[];
  total: number;
}> {
  const convIds = await loadConversationIndex(peerId);

  // Fetch metadata for each
  const convs: PeerConversation[] = [];
  for (const convId of convIds) {
    if (convs.length >= limit) break;
    const conv = await loadConversation(convId);
    if (conv) convs.push(conv);
  }

  // Also search for conversations where this peer is a participant
  // but not yet in the index (e.g. if indexed by the other peer first)
  const allEntries = await listSharedMemory({
    category: "peer-chat",
    search: conversationMetaKey(""),
  });
  for (const entry of allEntries) {
    if (!entry.key.startsWith("peer-chat:meta:")) continue;
    const convId = entry.key.replace("peer-chat:meta:", "");
    if (convIds.includes(convId)) continue;
    const conv = entry.value as unknown as PeerConversation;
    if (
      conv.participantPeerIds?.includes(peerId) &&
      !convs.some((c) => c.id === conv.id)
    ) {
      convs.push(conv);
      convIds.push(convId);
    }
  }

  // Update index if we found missing conversations
  if (convs.length > convIds.length) {
    await saveConversationIndex(peerId, convIds);
  }

  convs.sort(
    (a, b) =>
      new Date(b.lastActivityAt).getTime() -
      new Date(a.lastActivityAt).getTime(),
  );

  return {
    conversations: convs.slice(0, limit),
    total: convs.length,
  };
}

/**
 * Get messages for a conversation, with optional pagination.
 */
export async function getMessages(
  conversationId: string,
  opts?: { since?: string; limit?: number },
): Promise<{
  messages: PeerChatMessage[];
  conversation: PeerConversation | null;
}> {
  const conversation = await loadConversation(conversationId);
  const allMessages = await loadMessages(conversationId);

  let filtered = allMessages;
  if (opts?.since) {
    const sinceTime = new Date(opts.since).getTime();
    filtered = allMessages.filter(
      (m) => new Date(m.createdAt).getTime() > sinceTime,
    );
  }

  // Sort ascending (oldest first) for display
  filtered.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  if (opts?.limit && filtered.length > opts.limit) {
    filtered = filtered.slice(filtered.length - opts.limit);
  }

  return { messages: filtered, conversation };
}

/**
 * Mark messages in a conversation as read for a specific peer.
 */
export async function markAsRead(
  conversationId: string,
  peerId: string,
): Promise<boolean> {
  const conversation = await loadConversation(conversationId);
  if (!conversation) return false;

  conversation.unreadByPeer[peerId] = 0;
  await saveConversation(conversation);

  const messages = await loadMessages(conversationId);
  let changed = false;
  for (const msg of messages) {
    if (!msg.read && msg.recipientPeerId === peerId) {
      msg.read = true;
      changed = true;
    }
  }
  if (changed) {
    await saveMessages(conversationId, messages);
  }

  return true;
}

/**
 * Get unread count for a peer across all conversations.
 */
export async function getUnreadCount(peerId: string): Promise<number> {
  const { conversations } = await listConversations(peerId, 100);
  let total = 0;
  for (const conv of conversations) {
    total += conv.unreadByPeer[peerId] ?? 0;
  }
  return total;
}

/**
 * Find or create a conversation by participant IDs.
 * Looks up existing conversations that have the exact same participants.
 */
export async function findOrCreateConversation(params: {
  participantPeerIds: string[];
  participantAgentNames: string[];
  title?: string;
}): Promise<PeerConversation> {
  const { participantPeerIds, participantAgentNames, title } = params;

  // Search existing conversations for a match
  const allEntries = await listSharedMemory({
    category: "peer-chat",
    search: conversationMetaKey(""),
  });

  for (const entry of allEntries) {
    if (!entry.key.startsWith("peer-chat:meta:")) continue;
    const conv = entry.value as unknown as PeerConversation;
    if (!conv) continue;

    const samePeers =
      participantPeerIds.length === conv.participantPeerIds.length &&
      participantPeerIds.every((id) => conv.participantPeerIds.includes(id));
    const sameAgents =
      participantAgentNames.length === conv.participantAgentNames.length &&
      participantAgentNames.every((name) =>
        conv.participantAgentNames.includes(name),
      );

    if (samePeers && sameAgents) {
      return conv;
    }
  }

  // Create new
  const conversation: PeerConversation = {
    id: crypto.randomUUID(),
    title: title ?? `${participantAgentNames.join(" ↔ ")}`,
    participantPeerIds,
    participantAgentNames,
    lastActivityAt: nowIso(),
    unreadByPeer: {},
    createdAt: nowIso(),
  };

  await saveConversation(conversation);

  // Register in indices
  for (const pid of participantPeerIds) {
    const index = await loadConversationIndex(pid);
    index.unshift(conversation.id);
    await saveConversationIndex(pid, index);
  }

  return conversation;
}
