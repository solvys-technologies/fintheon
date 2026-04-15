// [claude-code 2026-04-15] T6: Bottom-anchored chat input — auto-grow textarea, send on Enter, disabled when loading

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export default function ChatInput({
  onSend,
  isLoading,
  disabled,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, isLoading, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  const canSend = text.trim().length > 0 && !isLoading && !disabled;

  return (
    <div
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border-visible)",
        padding: "12px 16px",
        paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          handleInput();
        }}
        onKeyDown={handleKeyDown}
        placeholder="Message Harper..."
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          resize: "none",
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 14,
          color: "var(--text-primary)",
          lineHeight: 1.5,
          maxHeight: 96,
          overflow: "auto",
        }}
      />
      <button
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Send message"
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: canSend ? "var(--accent)" : "var(--surface-raised)",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: canSend ? "pointer" : "default",
          flexShrink: 0,
          transition: "background 150ms ease-out",
        }}
      >
        <ArrowUp
          size={20}
          color={canSend ? "var(--black, #000)" : "var(--text-disabled)"}
        />
      </button>
    </div>
  );
}
