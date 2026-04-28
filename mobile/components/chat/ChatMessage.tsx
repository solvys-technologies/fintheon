// [claude-code 2026-04-18] v5.22 S2: per-user-message delivery status. Status flips
//   sending → sent on res.ok, sending/sent → error on transport errors. Renders as a
//   plain-text caption under the user bubble (FROM DESKTOP badge style — no glyphs,
//   no checkmark, no sparkle). silentHint carries the 12s no-stream watchdog string.
// [claude-code 2026-04-16] T7: React.memo wrapper for streaming perf
// [claude-code 2026-04-15] T6: Chat message bubble — markdown rendering, agent badge, streaming-ready

import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import AgentBadge from "./AgentBadge";

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
}

const STATUS_LABEL: Record<ChatMessageStatus, string> = {
  sending: "\u2026",
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-start",
        gap: 8,
        padding: "4px 16px",
      }}
    >
      {!isUser && <AgentBadge />}
      <div
        style={{
          maxWidth: "78%",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{
            background: isUser ? "var(--surface-raised)" : "var(--surface)",
            border: isUser ? "none" : "1px solid var(--border)",
            borderRadius: 12,
            padding: "12px 16px",
          }}
        >
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
            <div className="chat-markdown">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <p
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 14,
                        color: "var(--text-primary)",
                        margin: "0 0 8px 0",
                        lineHeight: 1.5,
                      }}
                    >
                      {children}
                    </p>
                  ),
                  code: ({ children, className }) => {
                    const isBlock = className?.includes("language-");
                    return isBlock ? (
                      <pre
                        style={{
                          background: "var(--surface-raised)",
                          borderRadius: 8,
                          padding: 12,
                          overflowX: "auto",
                          margin: "8px 0",
                        }}
                      >
                        <code
                          style={{
                            fontFamily: "var(--font-data)",
                            fontSize: 12,
                            color: "var(--text-primary)",
                          }}
                        >
                          {children}
                        </code>
                      </pre>
                    ) : (
                      <code
                        style={{
                          fontFamily: "var(--font-data)",
                          fontSize: 12,
                          color: "var(--accent)",
                          background: "var(--surface-raised)",
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}
                      >
                        {children}
                      </code>
                    );
                  },
                  strong: ({ children }) => (
                    <strong
                      style={{ color: "var(--text-display)", fontWeight: 500 }}
                    >
                      {children}
                    </strong>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "var(--accent)",
                        textDecoration: "underline",
                      }}
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </Markdown>
            </div>
          )}
        </div>
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
    </motion.div>
  );
}

const ChatMessage = memo(ChatMessageInner);
export default ChatMessage;
