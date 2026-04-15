// [claude-code 2026-04-15] T6: Session list bottom sheet — chat session history, new session button

import { motion, AnimatePresence } from "framer-motion";

export interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
}

interface SessionListProps {
  open: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNewSession: () => void;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
};

export default function SessionList({
  open,
  onClose,
  sessions,
  activeSessionId,
  onSelect,
  onNewSession,
}: SessionListProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 90,
            }}
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: "60vh",
              background: "var(--surface)",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              zIndex: 91,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Handle */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "10px 0 6px",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 2,
                  borderRadius: 1,
                  background: "var(--border-visible)",
                }}
              />
            </div>

            {/* New session button */}
            <button
              onClick={onNewSession}
              style={{
                margin: "0 16px 8px",
                padding: "10px 0",
                background: "transparent",
                border: "1px solid var(--border-visible)",
                borderRadius: 999,
                fontFamily: "'Space Mono', monospace",
                fontSize: 12,
                color: "var(--text-primary)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
            >
              [NEW SESSION]
            </button>

            {/* Session rows */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {sessions.map((s) => {
                const isActive = s.id === activeSessionId;
                return (
                  <button
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    style={{
                      width: "100%",
                      height: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 16px",
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      borderLeft: isActive
                        ? "2px solid var(--accent)"
                        : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: 14,
                        color: isActive
                          ? "var(--text-display)"
                          : "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.title}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        flexShrink: 0,
                        marginLeft: 12,
                      }}
                    >
                      {formatDate(s.timestamp)}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
