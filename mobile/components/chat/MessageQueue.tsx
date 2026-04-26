// [claude-code 2026-04-25] S42-T2 mobile: queued-message strip above the composer.
// Mirrors frontend/components/chat/MessageQueue.tsx shape (QueuedMessage + edit/remove)
// but uses inline styles to match the rest of mobile/ (which doesn't use Tailwind).
import { useState } from "react";

export interface QueuedMessage {
  id: string;
  text: string;
  timestamp: number;
}

interface MessageQueueProps {
  queue: QueuedMessage[];
  onEdit: (id: string, newText: string) => void;
  onRemove: (id: string) => void;
}

export default function MessageQueue({
  queue,
  onEdit,
  onRemove,
}: MessageQueueProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  if (queue.length === 0) return null;

  return (
    <div style={{ padding: "0 16px 8px" }}>
      <div
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--accent, #c79f4a)",
          marginBottom: 6,
        }}
      >
        Queued ({queue.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {queue.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(199,159,74,0.15)",
              background: "#0b0b08",
            }}
          >
            {editingId === msg.id ? (
              <>
                <input
                  autoFocus
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onEdit(msg.id, editText);
                      setEditingId(null);
                    }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  style={{
                    flex: 1,
                    fontSize: 13,
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(199,159,74,0.3)",
                    outline: "none",
                    color: "var(--text-primary)",
                    padding: "2px 0",
                  }}
                />
                <button
                  onClick={() => {
                    onEdit(msg.id, editText);
                    setEditingId(null);
                  }}
                  style={{
                    fontSize: 11,
                    background: "transparent",
                    border: "none",
                    color: "var(--accent, #c79f4a)",
                    cursor: "pointer",
                  }}
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {msg.text}
                </span>
                <button
                  onClick={() => {
                    setEditingId(msg.id);
                    setEditText(msg.text);
                  }}
                  style={{
                    fontSize: 11,
                    background: "transparent",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => onRemove(msg.id)}
                  style={{
                    fontSize: 11,
                    background: "transparent",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
