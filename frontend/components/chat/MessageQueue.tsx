import { useState } from 'react';
import { X, Edit3, Check, ListOrdered } from 'lucide-react';

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
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MessageQueue({ queue, onEdit, onRemove }: MessageQueueProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  if (queue.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-2">
        <ListOrdered size={12} className="text-[var(--fintheon-accent)]" />
        <span className="text-[11px] font-medium text-[var(--fintheon-accent)]">
          Queued ({queue.length})
        </span>
      </div>
      <div className="space-y-1.5">
        {queue.map((msg) => (
          <div
            key={msg.id}
            className="flex items-start gap-2 rounded-lg border border-[var(--fintheon-accent)]/10 bg-[#0b0b08] group"
            style={{ padding: '8px 10px' }}
          >
            {editingId === msg.id ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onEdit(msg.id, editText);
                      setEditingId(null);
                    }
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 bg-transparent text-[12px] text-white border-b border-[var(--fintheon-accent)]/30 focus:outline-none pb-0.5"
                />
                <button
                  onClick={() => { onEdit(msg.id, editText); setEditingId(null); }}
                  className="text-[var(--fintheon-accent)] hover:text-white transition-colors"
                >
                  <Check size={13} />
                </button>
              </div>
            ) : (
              <>
                <p className="flex-1 text-[12px] text-gray-300 truncate">{msg.text}</p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingId(msg.id); setEditText(msg.text); }}
                    className="text-gray-500 hover:text-[var(--fintheon-accent)] transition-colors"
                    title="Edit"
                  >
                    <Edit3 size={12} />
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
