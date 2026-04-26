// [claude-code 2026-04-25] S42-T3: bubble re-shaped around MessagePrimitive
//   slots + StreamdownText. Markdown rendering moves from react-markdown to
//   streamdown for code blocks / tables / KaTeX. `[N]` citation markers are
//   resolved against `activity.citations`; click dispatches the platform-
//   shared `fintheon:artifact` CustomEvent. Footer shows the `complete` event
//   stats when present and collapses gracefully otherwise.
// [claude-code 2026-04-18] v5.22 S2: per-user-message delivery status. Status flips
//   sending → sent on res.ok, sending/sent → error on transport errors. Renders as a
//   plain-text caption under the user bubble (FROM DESKTOP badge style — no glyphs,
//   no checkmark, no sparkle). silentHint carries the 12s no-stream watchdog string.
// [claude-code 2026-04-16] T7: React.memo wrapper for streaming perf
// [claude-code 2026-04-15] T6: Chat message bubble — markdown rendering, agent badge, streaming-ready

import { memo } from "react";
import { motion } from "framer-motion";
import AgentBadge from "./AgentBadge";
import { MessagePrimitive } from "./MessagePrimitive";
import { StreamdownText } from "./StreamdownText";
import { MessageFooter } from "./MessageFooter";
import type { MessageActivity } from "@frontend/types/bridge-stream";

export type ChatMessageStatus = "sending" | "sent" | "error";

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  /** Delivery status for user messages. Undefined for assistant messages and for
   *  user messages from completed/loaded conversations (no live send to track). */
  status?: ChatMessageStatus;
  /** Optional caption rendered alongside the status — used by the no-stream watchdog
   *  (e.g. "HARPER SILENT — CHECK DESKTOP RELAY") so the stream stays open while the
   *  user is told nothing has come back yet. */
  silentHint?: string;
  /** Live agent activity (tool calls, citations, thinking). When undefined the
   *  rail + footer are simply not rendered. */
  activity?: MessageActivity;
  /** When true the streaming caret blinks at the tail of the assistant text. */
  isStreaming?: boolean;
}

const STATUS_LABEL: Record<ChatMessageStatus, string> = {
  sending: "…",
  sent: "SENT",
  error: "FAILED",
};

const STATUS_COLOR: Record<ChatMessageStatus, string> = {
  sending: "var(--text-disabled)",
  sent: "var(--accent, #c79f4a)",
  error: "var(--error)",
};

interface ChatMessageProps {
  message: ChatMessageData;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

function ChatMessageInner({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const showFooter = !isUser && message.activity?.complete !== undefined;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <MessagePrimitive.Root role={message.role}>
        {!isUser && <AgentBadge />}
        <div
          style={{
            maxWidth: "78%",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <MessagePrimitive.Content role={message.role}>
            {isUser ? (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  color: "var(--text-primary)",
                  margin: 0,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {message.content}
              </p>
            ) : (
              <StreamdownText
                className="chat-markdown"
                content={message.content}
                isStreaming={message.isStreaming}
                citations={message.activity?.citations}
              />
            )}
          </MessagePrimitive.Content>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 10,
              color: "var(--text-disabled)",
              alignSelf: isUser ? "flex-end" : "flex-start",
              paddingLeft: isUser ? 0 : 4,
              paddingRight: isUser ? 4 : 0,
            }}
          >
            {formatTime(message.timestamp)}
          </span>
          {showFooter && message.activity?.complete && (
            <MessageFooter
              agent={message.activity.complete.agent}
              generatedAt={message.activity.complete.generatedAt}
              latencyMs={message.activity.complete.latencyMs}
              sourceCount={
                message.activity.complete.sourceCount ??
                message.activity.citations.length
              }
              model={message.activity.complete.model}
            />
          )}
          {isUser && message.status && (
            <span
              aria-live="polite"
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 8,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: STATUS_COLOR[message.status],
                alignSelf: "flex-end",
                paddingRight: 4,
                lineHeight: 1,
              }}
            >
              {STATUS_LABEL[message.status]}
            </span>
          )}
          {isUser && message.silentHint && (
            <span
              role="status"
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 8,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--warning, #d4a843)",
                alignSelf: "flex-end",
                paddingRight: 4,
                lineHeight: 1.2,
                maxWidth: "100%",
              }}
            >
              {message.silentHint}
            </span>
          )}
        </div>
      </MessagePrimitive.Root>
    </motion.div>
  );
}

const ChatMessage = memo(ChatMessageInner);
export default ChatMessage;
