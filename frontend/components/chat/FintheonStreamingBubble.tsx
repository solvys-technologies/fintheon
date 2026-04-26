// [claude-code 2026-04-25] S42-T3: streaming bubble re-built around the
//   message-primitive composition + streamdown text adapter. Markdown,
//   code blocks, citations and the streaming caret all flow through
//   StreamdownText. Plain `pre-wrap` fallback is retained for the
//   compact / cancelled paths where we don't want any markdown overhead.

import { useEffect, useRef } from "react";
import { MessagePrimitive } from "./MessagePrimitive";
import { StreamdownText } from "./StreamdownText";
import type { CitationEvent } from "../../types/bridge-stream";

interface FintheonStreamingBubbleProps {
  content: string;
  agentName?: string;
  compact?: boolean;
  citations?: readonly CitationEvent[];
}

export function FintheonStreamingBubble({
  content,
  agentName,
  compact = false,
  citations,
}: FintheonStreamingBubbleProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [content]);

  return (
    <MessagePrimitive.Root
      role="assistant"
      className={compact ? "" : "mb-3"}
      style={{ alignItems: "flex-start" }}
    >
      <div
        className={`relative max-w-[85%] rounded-lg border border-[rgba(199,159,74,0.10)] bg-[#0a0905] backdrop-blur-sm ${
          compact ? "text-[11px]" : "text-[13px]"
        }`}
        style={{ padding: compact ? "8px 10px" : "12px 16px" }}
      >
        {agentName && (
          <div className="text-[10px] text-[var(--fintheon-accent)] font-medium mb-1">
            {agentName}
          </div>
        )}
        <div className="text-[#f0ead6]/80 leading-relaxed">
          {compact ? (
            <span className="whitespace-pre-wrap">{content}</span>
          ) : (
            <StreamdownText
              content={content}
              isStreaming
              citations={citations}
              className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed"
            />
          )}
          {compact && (
            <span
              className="ml-0.5 inline-block w-[2px] align-text-bottom bg-[var(--fintheon-accent)]"
              style={{ height: "12px", animation: "p 1.5s ease-in-out infinite" }}
              aria-hidden="true"
            />
          )}
        </div>
        <div ref={endRef} />
      </div>
    </MessagePrimitive.Root>
  );
}
