// [claude-code 2026-04-10] S9-T4: Extracted Chain of Thought display from FintheonThread
import { type FC, useState, useEffect } from "react";

interface ChainOfThoughtProps {
  text: string;
  isStreaming?: boolean;
}

export const ChainOfThought: FC<ChainOfThoughtProps> = ({
  text,
  isStreaming,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isStreaming) {
      setIsOpen(true);
    } else if (text) {
      const timer = setTimeout(() => setIsOpen(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, text]);

  if (!text) return null;

  return (
    <div className="mb-3 rounded-lg bg-[var(--fintheon-accent)]/5 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-[var(--fintheon-accent)]/80 hover:text-[var(--fintheon-accent)] transition-colors"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
          <path d="M3.5 3.5l2 2M10.5 10.5l2 2M3.5 12.5l2-2M10.5 5.5l2-2" />
          <circle cx="8" cy="8" r="2" />
        </svg>
        <span>Chain of Thought</span>
        {isStreaming && (
          <span
            className="w-1.5 h-1.5 rounded-full ml-1"
            style={{
              backgroundColor: "var(--fintheon-accent)",
              animation: "p 1.5s ease-in-out infinite",
            }}
          />
        )}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className={`ml-auto transition-transform ${isOpen ? "rotate-90" : ""}`}
          fill="currentColor"
        >
          <path
            d="M3 1l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
};
