import { AlertCircle, CheckCircle2, ChevronUp, Circle } from "lucide-react";

interface ChatDrawerPeekProps {
  tone: "status" | "action";
  title: string;
  detail: string;
  onOpen: () => void;
}

export function ChatDrawerPeek({
  tone,
  title,
  detail,
  onOpen,
}: ChatDrawerPeekProps) {
  const Icon = tone === "action" ? AlertCircle : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="fintheon-chat-input-drawer fintheon-chat-input-drawer--peek"
      style={{ animation: "fintheon-stage-fade-pop 180ms ease-out" }}
      aria-label={`${title}: ${detail}`}
    >
      <span className="fintheon-chat-input-drawer-peek__content">
        {Icon ? (
          <Icon
            size={15}
            className="shrink-0 text-[var(--fintheon-secondary,var(--fintheon-muted))]"
            aria-hidden="true"
          />
        ) : (
          <span className="fintheon-todo-header-glyph" aria-hidden="true">
            <CheckCircle2 size={13} strokeWidth={2.3} />
            <span />
            <Circle size={8} strokeWidth={2.2} />
            <span />
          </span>
        )}
        <span className="flex min-w-0 flex-col">
          <span
            className={
              tone === "action"
                ? "text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--fintheon-accent)]"
                : "text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--fintheon-text)]/52"
            }
          >
            {title}
          </span>
          <span className="truncate text-[11px] leading-4 text-[var(--fintheon-text)]/58">
            {detail}
          </span>
        </span>
      </span>
      <span
        className="fintheon-chat-input-drawer-peek__action"
        aria-hidden="true"
      >
        <ChevronUp size={14} />
      </span>
    </button>
  );
}
