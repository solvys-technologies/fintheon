// [claude-code 2026-04-11] S14-T8: CAO memory flush — auto-flush every 10 messages, verbal flush, firm/personal scoping
/**
 * CAO Memory Flush Service
 *
 * 1. Auto-flush: After every 10th message in a conversation, scan the last 10
 *    exchanges for saveable insights and persist to peer_shared_memory.
 * 2. Verbal flush: Detect "remember this" / "save this" / "note this down" and
 *    immediately save the referenced content.
 * 3. Category scoping: "firm" for team-wide, "personal-{userId}" for individual.
 */

import { setSharedMemory } from "./peers/shared-memory.js";
import * as conversationStore from "./ai/conversation-store.js";

// ---------------------------------------------------------------------------
// Message count tracking (per conversation)
// ---------------------------------------------------------------------------

const messageCounters = new Map<string, number>();

/** Increment and return message count for a conversation */
export function trackMessage(conversationId: string): number {
  const count = (messageCounters.get(conversationId) ?? 0) + 1;
  messageCounters.set(conversationId, count);
  return count;
}

/** Check if we should auto-flush (every 10th message) */
export function shouldAutoFlush(conversationId: string): boolean {
  const count = messageCounters.get(conversationId) ?? 0;
  return count > 0 && count % 10 === 0;
}

// ---------------------------------------------------------------------------
// Verbal flush detection
// ---------------------------------------------------------------------------

const VERBAL_FLUSH_PATTERNS = [
  /\bremember this\b/i,
  /\bsave this\b/i,
  /\bnote this down\b/i,
  /\bnote this\b/i,
  /\bkeep this in memory\b/i,
  /\bstore this\b/i,
  /\bdon't forget\b/i,
];

/** Check if a user message contains a verbal flush trigger */
export function detectVerbalFlush(message: string): boolean {
  return VERBAL_FLUSH_PATTERNS.some((pattern) => pattern.test(message));
}

// ---------------------------------------------------------------------------
// Auto-flush: extract insights from last 10 messages
// ---------------------------------------------------------------------------

/**
 * Scan the last 10 messages of a conversation and extract key insights.
 * Returns saveable entries as key-value pairs for peer_shared_memory.
 */
export function extractInsights(
  messages: { role: string; content: string }[],
): { key: string; summary: string }[] {
  const insights: { key: string; summary: string }[] = [];

  // Scan assistant messages for actionable content
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const content = msg.content;

    // Trade ideas: look for ticker symbols + directional language
    const tradeMatch = content.match(
      /\b(long|short|buy|sell|bullish|bearish)\b[^.]{5,80}\b(\/[A-Z]{2,5}|[A-Z]{1,5})\b/i,
    );
    if (tradeMatch) {
      const key = `insight-trade-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      insights.push({
        key,
        summary: tradeMatch[0].trim().slice(0, 200),
      });
    }

    // Analysis conclusions: sentences with "therefore", "conclusion", "in summary"
    const conclusionMatch = content.match(
      /(?:therefore|in summary|conclusion|the key takeaway|bottom line)[^.]*\./i,
    );
    if (conclusionMatch) {
      const key = `insight-analysis-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      insights.push({
        key,
        summary: conclusionMatch[0].trim().slice(0, 300),
      });
    }

    // Market observations: sentences with specific levels/percentages
    const levelMatch = content.match(
      /\b\d{1,2}[,.]?\d{3,}(?:\.\d{1,2})?\b[^.]{5,100}\./,
    );
    if (levelMatch) {
      const key = `insight-level-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      insights.push({
        key,
        summary: levelMatch[0].trim().slice(0, 200),
      });
    }
  }

  // Deduplicate by summary prefix (first 50 chars)
  const seen = new Set<string>();
  return insights.filter((i) => {
    const prefix = i.summary.slice(0, 50);
    if (seen.has(prefix)) return false;
    seen.add(prefix);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Flush to shared memory
// ---------------------------------------------------------------------------

/**
 * Auto-flush: extract insights from last 10 messages and save to shared memory.
 * Called after every 10th message in a conversation.
 */
export async function autoFlushMemory(
  conversationId: string,
  userId: string,
): Promise<number> {
  const messages = await conversationStore.getMessages(conversationId, 10);
  const filtered = messages.map((m) => ({ role: m.role, content: m.content }));

  if (filtered.length < 10) return 0;

  const insights = extractInsights(filtered);
  let saved = 0;

  for (const insight of insights) {
    await setSharedMemory(
      insight.key,
      {
        summary: insight.summary,
        conversationId,
        flushedAt: new Date().toISOString(),
        source: "auto-flush",
      },
      {
        category: `personal-${userId}`,
        agentName: "harper-opus",
        ttlHours: 168, // 7 days
      },
    );
    saved++;
  }

  if (saved > 0) {
    console.log(
      `[CAOMemory] Auto-flushed ${saved} insights from conversation ${conversationId}`,
    );
  }
  return saved;
}

/**
 * Verbal flush: save a specific message's context to shared memory immediately.
 * Saves both the user message (trigger) and the preceding assistant message (context).
 */
export async function verbalFlushMemory(
  conversationId: string,
  userId: string,
  userMessage: string,
): Promise<string> {
  // Get last few messages for context
  const messages = await conversationStore.getMessages(conversationId, 4);
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");

  const contentToSave = lastAssistant
    ? lastAssistant.content.slice(0, 500)
    : userMessage.slice(0, 500);

  const key = `verbal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  await setSharedMemory(
    key,
    {
      content: contentToSave,
      triggerMessage: userMessage.slice(0, 200),
      conversationId,
      savedAt: new Date().toISOString(),
      source: "verbal-flush",
    },
    {
      category: `personal-${userId}`,
      agentName: "harper-opus",
      ttlHours: 720, // 30 days — verbal saves are more intentional
    },
  );

  console.log(
    `[CAOMemory] Verbal flush saved: ${key} (${contentToSave.length} chars)`,
  );
  return key;
}

/**
 * Save a memory entry with firm-wide visibility (all CAOs can see it).
 */
export async function saveFirmMemory(
  key: string,
  value: Record<string, unknown>,
  agentName = "harper-opus",
): Promise<void> {
  await setSharedMemory(key, value, {
    category: "firm",
    agentName,
    ttlHours: null, // firm memories don't expire
  });
}

/**
 * Save a memory entry scoped to a specific user's CAO.
 */
export async function savePersonalMemory(
  key: string,
  value: Record<string, unknown>,
  userId: string,
  agentName = "harper-opus",
): Promise<void> {
  await setSharedMemory(key, value, {
    category: `personal-${userId}`,
    agentName,
    ttlHours: 720, // 30 days default
  });
}
