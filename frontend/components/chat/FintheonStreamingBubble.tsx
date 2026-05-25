import { useRef, useEffect, useState } from "react";
import { BrailleSpinner } from "./primitive/BrailleSpinner";

interface FintheonStreamingBubbleProps {
  content: string;
  agentName?: string;
  compact?: boolean;
}

/**
 * Streaming bubble with token-level t-text-swap reveal.
 * Replaces the legacy blinking-cursor span with Solvys t-text-swap
 * so each new token arrival slides up + unblurs into place.
 */
export function FintheonStreamingBubble({
  content,
  agentName,
  compact = false,
}: FintheonStreamingBubbleProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);
  const [swapKey, setSwapKey] = useState(0);

  // Scroll-to-bottom on new content
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [content]);

  // t-text-swap token reveal — when new tokens arrive, remount the swap
  // span so the enter animation fires for just the new portion.
  useEffect(() => {
    if (content.length > prevLenRef.current) {
      prevLenRef.current = content.length;
      setSwapKey((k) => k + 1);
    } else {
      prevLenRef.current = content.length;
    }
  }, [content]);

  const hasContent = content.length > 0;

  return (
    <div className={`flex justify-start ${compact ? "" : "mb-3"}`}>
      <div
        className={`relative max-w-[85%] rounded-lg border border-[rgba(199,159,74,0.10)] bg-[#0a0905] backdrop-blur-sm ${
          compact ? "text-[11px]" : "text-[13px]"
        }`}
        style={{ padding: compact ? "8px 10px" : "12px 16px" }}
      >
        {/* Agent name + BrailleSpinner when streaming (no content yet) */}
        {agentName && (
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--fintheon-accent)] font-medium mb-1">
            <span>{agentName}</span>
            {!hasContent && <BrailleSpinner size={10} />}
          </div>
        )}

        {/* t-text-swap reveal — remounts on new tokens so each chunk enters */}
        <div className="text-[#f0ead6]/80 leading-relaxed whitespace-pre-wrap">
          <span key={swapKey} className="t-text-swap">
            {content}
          </span>
        </div>

        <div ref={endRef} />
      </div>
    </div>
  );
}
