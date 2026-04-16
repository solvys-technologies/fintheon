// [claude-code 2026-04-05] Strands ConversationManager backed by conversation-store DB
// Loads history from the DB before invocation, saves new messages after.
import {
  ConversationManager,
  type ConversationManagerReduceOptions,
  BeforeInvocationEvent,
  AfterInvocationEvent,
  Message,
  TextBlock,
  type LocalAgent,
} from "@strands-agents/sdk";
import {
  getRecentContext,
  addMessage,
  getMessages,
} from "../ai/conversation-store.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("StrandsMemory");
const MAX_WINDOW = 40;
const DEDUP_WINDOW_MS = 5_000; // 5s window for idempotency check

/**
 * ConversationManager that bridges Strands agent memory with our DB-backed
 * conversation store. Loads recent context before invocation and persists
 * new assistant messages after invocation.
 */
class DbConversationManager extends ConversationManager {
  readonly name = "fintheon:db-conversation-manager";

  constructor(
    private conversationId: string,
    private userId: string,
  ) {
    super();
  }

  /** Overflow recovery: trim oldest messages to fit context window */
  reduce({ agent }: ConversationManagerReduceOptions): boolean {
    if (agent.messages.length <= 4) return false;
    // Remove the oldest quarter of messages
    const removeCount = Math.max(2, Math.floor(agent.messages.length / 4));
    agent.messages.splice(0, removeCount);
    return true;
  }

  /**
   * Register hooks to load history before invocation and save after.
   * Calls super.initAgent() to preserve overflow recovery from base class.
   */
  initAgent(agent: LocalAgent): void {
    super.initAgent(agent);

    // Before invocation: load recent context from DB into agent messages
    agent.addHook(BeforeInvocationEvent, async () => {
      // Only seed if the agent has no messages yet (first invocation)
      if (agent.messages.length > 0) return;

      try {
        const history = await getRecentContext(this.conversationId);
        for (const msg of history) {
          const role = msg.role === "assistant" ? "assistant" : "user";
          agent.messages.push(
            new Message({ role, content: [new TextBlock(msg.content)] }),
          );
        }
        log.info("Loaded conversation history", {
          conversationId: this.conversationId,
          messageCount: history.length,
        });
      } catch (err) {
        log.warn("Failed to load conversation history", { error: String(err) });
      }
    });

    // After invocation: save new assistant messages to DB (with idempotency guard)
    agent.addHook(AfterInvocationEvent, async () => {
      try {
        // Find the last assistant message
        const lastMsg = [...agent.messages]
          .reverse()
          .find((m) => m.role === "assistant");
        if (!lastMsg) return;

        // Extract text content from the message
        const text = lastMsg.content
          .filter((b): b is TextBlock => b instanceof TextBlock)
          .map((b) => b.text)
          .join("");

        if (!text) return;

        // Idempotency guard: check if this assistant message was already saved
        // (e.g. by DbConversationManager dual-write or relay persistence)
        const recent = await getMessages(this.conversationId, 3);
        const now = Date.now();
        const alreadySaved = recent.some(
          (m) =>
            m.role === "assistant" &&
            now - new Date(m.createdAt).getTime() < DEDUP_WINDOW_MS &&
            m.content.slice(0, 200) === text.slice(0, 200),
        );

        if (alreadySaved) {
          log.info("Skipped duplicate assistant message", {
            conversationId: this.conversationId,
          });
          return;
        }

        await addMessage(this.conversationId, {
          conversationId: this.conversationId,
          role: "assistant",
          content: text,
        });

        log.info("Saved assistant message", {
          conversationId: this.conversationId,
          textLen: text.length,
        });
      } catch (err) {
        log.warn("Failed to save assistant message", { error: String(err) });
      }
    });
  }
}

/**
 * Create a ConversationManager that reads/writes to the existing conversation store.
 */
export function createConversationManager(
  conversationId: string,
  userId: string,
): ConversationManager {
  return new DbConversationManager(conversationId, userId);
}
