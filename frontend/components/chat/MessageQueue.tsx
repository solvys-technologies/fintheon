// S38-T1: Expanded MessageQueue — drag-reorder, Send All/One, session storage
import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  PencilLine,
  Check,
  ListOrdered,
  Send,
  GripVertical,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface QueuedMessage {
  id: string;
  text: string;
  timestamp: number;
}

interface MessageQueueProps {
  queue: QueuedMessage[];
  onEdit: (id: string, newText: string) => void;
  onRemove: (id: string) => void;
  onReorder?: (fromIdx: number, toIdx: number) => void;
  onSendAll?: () => void;
  onSendOne?: () => void;
  storageKey?: string;
}

const STORAGE_KEY = "fintheon:message-queue";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

export function loadQueue(storageKey = STORAGE_KEY): QueuedMessage[] {
  try {
    const raw = sessionStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveQueue(
  queue: QueuedMessage[],
  storageKey = STORAGE_KEY,
): void {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(queue));
  } catch {
    // Storage full or unavailable — silently degrade
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MessageQueue({
  queue,
  onEdit,
  onRemove,
  onReorder,
  onSendAll,
  onSendOne,
  storageKey,
}: MessageQueueProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const dragIdxRef = useRef<number | null>(null);

  // Persist to session storage on queue change
  useEffect(() => {
    saveQueue(queue, storageKey);
  }, [queue, storageKey]);

  // Drag-and-drop reorder
  const handleDragStart = useCallback((idx: number) => {
    dragIdxRef.current = idx;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (idx: number) => {
      const from = dragIdxRef.current;
      if (from !== null && from !== idx && onReorder) {
        onReorder(from, idx);
      }
      dragIdxRef.current = null;
    },
    [onReorder],
  );

  if (queue.length === 0) return null;

  return (
    <div className="mb-3">
      {/* Header with actions */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <ListOrdered size={12} className="text-[var(--fintheon-accent)]" />
          <span className="text-[11px] font-medium text-[var(--fintheon-accent)]">
            Queued ({queue.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onSendOne && queue.length > 0 && (
            <button
              onClick={onSendOne}
              className="text-[10px] font-medium text-[var(--fintheon-accent)] hover:text-[#f0ead6] underline underline-offset-2 transition-colors"
              title="Send first message only"
            >
              Send One
            </button>
          )}
          {onSendAll && queue.length > 0 && (
            <button
              onClick={onSendAll}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/20 transition-colors"
              title="Send all queued messages"
            >
              <Send size={10} />
              Send All
            </button>
          )}
        </div>
      </div>

      {/* Queue items */}
      <div className="space-y-1.5">
        {queue.map((msg, idx) => (
          <div
            key={msg.id}
            draggable={!!onReorder}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(idx)}
            className="flex items-start gap-2 rounded-lg border border-[var(--fintheon-accent)]/10 bg-[#0b0b08] group cursor-grab active:cursor-grabbing"
            style={{ padding: "8px 10px" }}
          >
            {/* Drag handle */}
            {onReorder && (
              <div className="flex-shrink-0 mt-0.5 text-zinc-600 group-hover:text-zinc-400 transition-colors">
                <GripVertical size={12} />
              </div>
            )}

            {editingId === msg.id ? (
              <div className="flex-1 flex items-center gap-2">
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
                  className="flex-1 bg-transparent text-[12px] text-[#f0ead6] border-b border-[var(--fintheon-accent)]/30 focus:outline-none pb-0.5"
                />
                <button
                  onClick={() => {
                    onEdit(msg.id, editText);
                    setEditingId(null);
                  }}
                  className="text-[var(--fintheon-accent)] hover:text-[#f0ead6] transition-colors"
                >
                  <Check size={13} />
                </button>
              </div>
            ) : (
              <>
                <p className="flex-1 text-[12px] text-gray-300 truncate">
                  {msg.text}
                </p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setEditingId(msg.id);
                      setEditText(msg.text);
                    }}
                    className="text-gray-500 hover:text-[var(--fintheon-accent)] transition-colors"
                    title="Edit"
                  >
                    <PencilLine size={12} />
                  </button>
                  <button
                    onClick={() => onRemove(msg.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                    title="Remove"
                  >
                    <X size={12} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
