// [claude-code 2026-04-16] T7: React.memo wrapper for streaming perf
// [claude-code 2026-04-15] T6: Chat message bubble — markdown rendering, agent badge, streaming-ready

import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import AgentBadge from "./AgentBadge";

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

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
                fontSize: 14,
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
              />
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
      </div>
    </motion.div>
  );
}

const ChatMessage = memo(ChatMessageInner);
export default ChatMessage;
