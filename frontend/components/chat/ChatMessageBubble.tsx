// [claude-code 2026-04-25] S42-T3: bubble re-shaped around MessagePrimitive
//   slots (Root → Content → Activity → Footer → Actions). Markdown text now
//   flows through StreamdownText with `[N]` citation chip parsing. The Take
//   Note bookmark moves into the Actions slot. AgentActivityRail renders the
//   per-message activity (tool_call / citation / thinking) when present.
// [claude-code 2026-03-29] S9-T5: Checkpoint → Take Note (saves to Harper memory via Context Bank)
import { forwardRef } from "react";
import { Bookmark } from "lucide-react";
import type { ChatMessage } from "./types";
import { MessagePartRenderer } from "./parts/MessagePartRenderer";
import { isReportHtml, ReportViewer } from "./ReportViewer";
import { MessagePrimitive } from "./MessagePrimitive";
import { MessageFooter } from "./MessageFooter";
import { AgentActivityRail } from "./AgentActivityRail";
import type { MessageActivity } from "../../types/bridge-stream";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onTakeNote?: (messageId: string, content: string) => void;
  /** Live agent activity (tool calls, citations, thinking) for this message. */
  activity?: MessageActivity;
}

export const ChatMessageBubble = forwardRef<
  HTMLDivElement,
  ChatMessageBubbleProps
>(function ChatMessageBubble(
  { message, isStreaming, onTakeNote, activity },
  ref,
) {
  const formatTimestamp = (date: Date) => {
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    const time = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${mm}/${dd}/${yy} ${time}`;
  };

  const textContent = message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");

  const reportHtml =
    message.role === "assistant" && !message.cancelled
      ? message.parts.find(
          (p) => p.type === "text" && isReportHtml((p as any).text),
        )
      : null;

  const isAssistant = message.role === "assistant";
  const showRail = isAssistant && !message.cancelled && activity !== undefined;
  const showFooter =
    isAssistant && !message.cancelled && activity?.complete !== undefined;

  return (
    <MessagePrimitive.Root role={message.role} cancelled={message.cancelled}>
      <MessagePrimitive.Content
        ref={ref}
        role={message.role}
        cancelled={message.cancelled}
      >
        {message.role === "assistant" ? (
          <div
            className={`text-sm max-w-none ${message.cancelled ? "text-zinc-500 italic" : "text-zinc-300"}`}
          >
            {message.cancelled ? (
              <p className="text-xs">
                {textContent || "This message was cancelled"}
              </p>
            ) : reportHtml ? (
              <ReportViewer
                html={(reportHtml as any).text}
                onClose={() => {}}
              />
            ) : (
              <MessagePartRenderer
                parts={message.parts}
                isStreaming={isStreaming}
                citations={activity?.citations}
              />
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">
            {textContent}
          </p>
        )}
      </MessagePrimitive.Content>

      {showRail && activity && (
        <MessagePrimitive.Activity>
          <AgentActivityRail activity={activity} variant="vertical" />
        </MessagePrimitive.Activity>
      )}

      {showFooter && activity?.complete && (
        <MessagePrimitive.Footer>
          <MessageFooter
            agent={activity.complete.agent}
            generatedAt={activity.complete.generatedAt}
            latencyMs={activity.complete.latencyMs}
            sourceCount={
              activity.complete.sourceCount ?? activity.citations.length
            }
            model={activity.complete.model}
          />
        </MessagePrimitive.Footer>
      )}

      <MessagePrimitive.Actions>
        <span
          className={`text-[9px] font-mono ${message.cancelled ? "text-zinc-700" : "text-zinc-600"}`}
        >
          {formatTimestamp(message.createdAt)}
        </span>
        {message.role === "assistant" && !message.cancelled && onTakeNote && (
          <button
            onClick={() => onTakeNote(message.id, textContent)}
            className="flex items-center gap-1 text-zinc-600 hover:text-[color:var(--fintheon-accent)] transition-colors"
            title="Take Note — save to Harper memory"
          >
            <Bookmark className="w-3 h-3" />
            <span className="text-[9px]">Note</span>
          </button>
        )}
      </MessagePrimitive.Actions>
    </MessagePrimitive.Root>
  );
});
