// [claude-code 2026-05-20] SOL-62: Todo + Queue drawer sliding up from composer
import { useState } from "react";
import {
  X,
  ChevronDown,
  ChevronRight,
  Circle,
  CheckCircle2,
} from "lucide-react";
import type { IssueTrackingType, TodoItem } from "./hooks/useTodoList";
import { MessageQueue, type QueuedMessage } from "./MessageQueue";
import { BrailleSpinner } from "./primitive/BrailleSpinner";
import { RepoChatComposerSurface } from "./composer/RepoChatComposer";

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
  approvalPending?: boolean;
  agentActive?: boolean;
}

type TodoStage = "todo" | "in_progress" | "awaiting_review" | "complete";

const ISSUE_TYPE_META: Record<IssueTrackingType, { label: string }> = {
  task: { label: "Task" },
  bug: { label: "Bug" },
  feature: { label: "Feature" },
  risk: { label: "Risk" },
  chore: { label: "Chore" },
  issue: { label: "Issue" },
};

function issueTypeLabel(type?: IssueTrackingType): string {
  return ISSUE_TYPE_META[type ?? "task"].label;
}

const TODO_STATUS_COLOR = "var(--fintheon-secondary, var(--fintheon-muted))";

function TodoHeaderGlyph() {
  return (
    <span className="fintheon-todo-header-glyph" aria-hidden="true">
      <CheckCircle2 size={13} strokeWidth={2.3} />
      <span />
      <Circle size={8} strokeWidth={2.2} />
      <span />
    </span>
  );
}

function getTodoStage(
  todo: TodoItem,
  approvalPending?: boolean,
  agentActive?: boolean,
): TodoStage {
  if (todo.done) return "complete";
  if (approvalPending && todo.source === "harper-ui-tool") {
    return "awaiting_review";
  }
  if (agentActive && todo.source === "harper-ui-tool") {
    return "in_progress";
  }
  return "todo";
}

function StageIcon({ stage }: { stage: TodoStage }) {
  if (stage === "complete") {
    return (
      <CheckCircle2
        size={16}
        strokeWidth={2.2}
        color={TODO_STATUS_COLOR}
        aria-hidden="true"
      />
    );
  }
  if (stage === "awaiting_review" || stage === "in_progress") {
    return <BrailleSpinner size={8} color={TODO_STATUS_COLOR} />;
  }
  return (
    <Circle
      size={16}
      strokeWidth={2.1}
      color={TODO_STATUS_COLOR}
      aria-hidden="true"
    />
  );
}

function stageLabel(stage: TodoStage): string {
  if (stage === "complete") return "Complete";
  if (stage === "in_progress") return "In progress";
  if (stage === "awaiting_review") return "Awaiting review";
  return "To-do";
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
  approvalPending,
  agentActive,
}: TodoDrawerProps) {
  const [queueOpen, setQueueOpen] = useState(true);
  const hasTodos = todos.length > 0;
  const hasQueue = queue.length > 0;

  const pendingTodos = todos.filter((t) => !t.done);
  const doneCount = todos.length - pendingTodos.length;

  return (
    <RepoChatComposerSurface
      open={isOpen}
      maxHeight="196px"
      style={{
        transition: "max-height 220ms cubic-bezier(0.4, 0, 0.2, 1)",
        borderColor:
          "color-mix(in srgb, var(--fintheon-accent) 18%, transparent)",
      }}
    >
      <div className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--fintheon-accent)]/10 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <TodoHeaderGlyph />
            <span className="truncate text-[13px] font-semibold leading-none text-[var(--fintheon-text)]/88">
              {doneCount} of {todos.length} task{todos.length === 1 ? "" : "s"}{" "}
              completed
            </span>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-[var(--fintheon-text)]/45 transition-colors hover:text-[var(--fintheon-text)]/80"
            title="Close"
          >
            <ChevronDown size={16} />
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "155px" }}>
          {hasTodos && (
            <div className="border-b border-[var(--fintheon-accent)]/8 py-1.5">
              <div className="pb-0.5">
                {todos.map((todo, index) => {
                  const stage = getTodoStage(
                    todo,
                    approvalPending,
                    agentActive,
                  );
                  const typeLabel = issueTypeLabel(todo.issueTrackingType);
                  return (
                    <div
                      key={todo.id}
                      className="fintheon-todo-stage-row group grid grid-cols-[18px_1.45rem_minmax(0,1fr)_16px] items-start gap-2 px-3 py-1.5 transition-colors hover:bg-[var(--fintheon-accent)]/5"
                      data-issue-type={todo.issueTrackingType ?? "task"}
                      data-stage={stage}
                    >
                      <button
                        key={`${todo.id}-${stage}`}
                        onClick={() => onToggleTodo(todo.id)}
                        className="fintheon-todo-stage-icon mt-0.5 shrink-0 transition-[color,transform,opacity] duration-200 hover:scale-110"
                        title={`${typeLabel} ${stageLabel(stage)}`}
                        aria-label={`${typeLabel} ${stageLabel(stage)}: ${todo.text}`}
                      >
                        <StageIcon stage={stage} />
                      </button>
                      <span className="text-right text-[13px] leading-5 text-[var(--fintheon-text)]/42">
                        {index + 1}.
                      </span>
                      <span
                        className={`min-w-0 text-[13px] leading-5 ${
                          stage === "complete"
                            ? "text-[var(--fintheon-text)]/48"
                            : "text-[var(--fintheon-text)]/82"
                        }`}
                      >
                        <span
                          className={stage === "complete" ? "line-through" : ""}
                        >
                          {todo.text}
                        </span>
                      </span>
                      <button
                        onClick={() => onRemoveTodo(todo.id)}
                        className="mt-0.5 opacity-0 text-[var(--fintheon-text)]/30 transition-all hover:text-[var(--fintheon-accent)]/60 group-hover:opacity-100"
                        title="Remove task"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
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
                  <ChevronDown
                    size={11}
                    className="text-[var(--fintheon-accent)]/50"
                  />
                ) : (
                  <ChevronRight
                    size={11}
                    className="text-[var(--fintheon-accent)]/50"
                  />
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
    </RepoChatComposerSurface>
  );
}
