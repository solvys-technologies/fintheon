import { CheckCircle2 } from "lucide-react";
import { StreamdownChat } from "./slots";
import type { ChatAnswerWidget } from "./hooks/useChatUiActions";

interface ChatAnswerStreamWidgetsProps {
  widgets: ChatAnswerWidget[];
}

export function ChatAnswerStreamWidgets({
  widgets,
}: ChatAnswerStreamWidgetsProps) {
  if (widgets.length === 0) return null;

  return (
    <>
      {widgets.map((widget) => (
        <div
          key={widget.id}
          className="max-w-[85%] rounded-lg border border-[var(--fintheon-accent)]/16 bg-[#0a0905] px-3 py-2.5"
        >
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 size={13} className="text-[var(--fintheon-accent)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--fintheon-accent)]/80">
              Answers Captured
            </span>
          </div>
          <div className="fintheon-chat-markdown text-[12px] text-[var(--fintheon-text)]/82">
            <StreamdownChat content={widget.markdown} />
          </div>
        </div>
      ))}
    </>
  );
}
