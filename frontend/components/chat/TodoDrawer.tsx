// [claude-code 2026-05-20] SOL-62: Todo + Queue drawer sliding up from composer
import { useState } from "react";
import {
  X,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  ListTodo,
} from "lucide-react";
import type { TodoItem } from "./hooks/useTodoList";
import { MessageQueue, type QueuedMessage } from "./MessageQueue";

interface TodoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  todos: TodoItem[];
  onToggleTodo: (id: string) => void;
  onRemoveTodo: (id: string) => void;
  queue: QueuedMessage[];
  onEditQueue: (id: string, text: string) => void;
  onRemoveQueue: (id: string) => void;
  onReorderQueue?: (fromIdx: number, toIdx: number) => void;
  onSendQueueOne?: () => void;
  onSendQueueAll?: () => void;
}

export function TodoDrawer({
  isOpen,
  onClose,
  todos,
  onToggleTodo,
  onRemoveTodo,
  queue,
  onEditQueue,
  onRemoveQueue,
  onReorderQueue,
  onSendQueueOne,
  onSendQueueAll,
}: TodoDrawerProps) {
  const [todoOpen, setTodoOpen] = useState(true);
  const [queueOpen, setQueueOpen] = useState(true);
  const hasTodos = todos.length > 0;
  const hasQueue = queue.length > 0;

  const pendingTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);

  return (
    <div
      className="mx-auto w-[calc(100%-32px)] max-w-[44rem] overflow-hidden"
      style={{
        maxHeight: isOpen ? "340px" : "0",
        transition: "max-height 220ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div
        className="overflow-hidden rounded-t-2xl"
        style={{
          background:
            "color-mix(in srgb, var(--fintheon-accent) 10%, rgba(5,4,2,0.76))",
          border: "1px solid color-mix(in srgb, var(--fintheon-accent) 18%, transparent)",
          borderBottom: "none",
          backdropFilter: "blur(24px) saturate(1.25)",
          WebkitBackdropFilter: "blur(24px) saturate(1.25)",
          boxShadow: "0 -18px 48px rgba(0,0,0,0.28)",
        }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--fintheon-accent)]/10">
          <div className="flex items-center gap-2">
            <ListTodo size={13} className="text-[var(--fintheon-accent)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--fintheon-accent)]">
              Active Work
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--fintheon-text)]/30 hover:text-[var(--fintheon-text)]/70 transition-colors"
            title="Close"
          >
            <X size={13} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto" style={{ maxHeight: "286px" }}>
          {/* ── To-Do section ─────────────────────────────────────────── */}
          {hasTodos && (
          <div className="border-b border-[var(--fintheon-accent)]/8">
            <button
              onClick={() => setTodoOpen((v) => !v)}
              className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-[var(--fintheon-accent)]/5 transition-colors"
            >
              {todoOpen ? (
                <ChevronDown size={11} className="text-[var(--fintheon-accent)]/50" />
              ) : (
                <ChevronRight size={11} className="text-[var(--fintheon-accent)]/50" />
              )}
              <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--fintheon-text)]/40">
                To-Do
              </span>
              {pendingTodos.length > 0 && (
                <span className="ml-1 text-[9px] text-[var(--fintheon-accent)]/60 bg-[var(--fintheon-accent)]/10 px-1.5 py-0.5 rounded-full">
                  {pendingTodos.length}
                </span>
              )}
            </button>

            {todoOpen && (
              <div className="pb-2">
                {pendingTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center gap-2 px-3 py-1.5 group hover:bg-[var(--fintheon-accent)]/5 transition-colors"
                  >
                    <button
                      onClick={() => onToggleTodo(todo.id)}
                      className="shrink-0 text-[var(--fintheon-text)]/30 hover:text-[var(--fintheon-accent)] transition-colors"
                    >
                      <Square size={12} />
                    </button>
                    <span className="flex-1 text-[12px] text-[var(--fintheon-text)]/70 truncate">
                      {todo.text}
                    </span>
                    <button
                      onClick={() => onRemoveTodo(todo.id)}
                      className="opacity-0 group-hover:opacity-100 text-[var(--fintheon-text)]/30 hover:text-[var(--fintheon-accent)]/60 transition-all"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}

                {doneTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center gap-2 px-3 py-1.5 group hover:bg-[var(--fintheon-accent)]/5 transition-colors opacity-35"
                  >
                    <button
                      onClick={() => onToggleTodo(todo.id)}
                      className="shrink-0 text-[var(--fintheon-accent)] transition-colors"
                    >
                      <CheckSquare size={12} />
                    </button>
                    <span className="flex-1 text-[12px] text-[var(--fintheon-text)]/50 truncate line-through">
                      {todo.text}
                    </span>
                    <button
                      onClick={() => onRemoveTodo(todo.id)}
                      className="opacity-0 group-hover:opacity-100 text-[var(--fintheon-text)]/30 hover:text-[var(--fintheon-accent)]/60 transition-all"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}

              </div>
            )}
          </div>
          )}

          {/* ── Queue section ─────────────────────────────────────────── */}
          {hasQueue && (
          <div>
            <button
              onClick={() => setQueueOpen((v) => !v)}
              className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-[var(--fintheon-accent)]/5 transition-colors"
            >
              {queueOpen ? (
                <ChevronDown size={11} className="text-[var(--fintheon-accent)]/50" />
              ) : (
                <ChevronRight size={11} className="text-[var(--fintheon-accent)]/50" />
              )}
              <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--fintheon-text)]/40">
                Queue
              </span>
              {queue.length > 0 && (
                <span className="ml-1 text-[9px] text-[var(--fintheon-accent)]/60 bg-[var(--fintheon-accent)]/10 px-1.5 py-0.5 rounded-full">
                  {queue.length}
                </span>
              )}
            </button>

            {queueOpen && (
              <div className="px-3 pb-3">
                <MessageQueue
                  queue={queue}
                  onEdit={onEditQueue}
                  onRemove={onRemoveQueue}
                  onReorder={onReorderQueue}
                  onSendOne={onSendQueueOne}
                  onSendAll={onSendQueueAll}
                />
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
