import { useRef, useEffect } from "react";

interface FintheonStreamingBubbleProps {
  content: string;
  agentName?: string;
  compact?: boolean;
}

export function FintheonStreamingBubble({
  content,
  agentName,
  compact = false,
}: FintheonStreamingBubbleProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [content]);

  return (
    <div className={`flex justify-start ${compact ? "" : "mb-3"}`}>
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
        <div className="text-[#f0ead6]/80 leading-relaxed whitespace-pre-wrap">
          {content}
          <span
            className="inline-block w-[2px] ml-0.5"
            style={{
              height: compact ? "12px" : "14px",
              backgroundColor: "var(--fintheon-accent)",
              verticalAlign: "text-bottom",
              animation: "p 1.5s ease-in-out infinite",
            }}
          />
        </div>
        <div ref={endRef} />
      </div>
    </div>
  );
}
