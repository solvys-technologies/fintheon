// [claude-code 2026-03-29] S9-T5: Checkpoint → Take Note (saves to Harper memory via Context Bank)
import { forwardRef } from "react";
import { Bookmark } from "@/components/shared/iso-icons";
import type { ChatMessage } from "./types";
import { MessagePartRenderer } from "./parts/MessagePartRenderer";
import { isReportHtml, ReportViewer } from "./ReportViewer";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onTakeNote?: (messageId: string, content: string) => void;
}

export const ChatMessageBubble = forwardRef<
  HTMLDivElement,
  ChatMessageBubbleProps
>(function ChatMessageBubble({ message, isStreaming, onTakeNote }, ref) {
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

  // Extract full text content for checkpoint excerpt
  const textContent = message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");

  // Check if any text part is a report
  const reportHtml =
    message.role === "assistant" && !message.cancelled
      ? message.parts.find(
          (p) => p.type === "text" && isReportHtml((p as any).text),
        )
      : null;

  return (
    <div
      className={`group/msg flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
    >
      <div
        ref={ref}
        className={[
          "max-w-[82%] rounded-2xl p-4 backdrop-blur-md border transition-colors",
          message.role === "user"
            ? "fintheon-user-bubble"
            : message.cancelled
              ? "bg-white/[0.03] border-white/5 opacity-50"
              : "bg-[#0f0f0b]/92 border-white/10 shadow-[0_12px_28px_rgba(0,0,0,0.35)]",
        ].join(" ")}
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
              />
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">
            {textContent}
          </p>
        )}
      </div>
      {/* Timestamp + Take Note — visible on hover beneath bubble */}
      <div className="flex items-center gap-2 mt-1 px-2 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200">
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
      </div>
    </div>
  );
});
