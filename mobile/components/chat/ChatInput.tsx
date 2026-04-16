// [claude-code 2026-04-16] Nothing-styled chat input — label, bordered textarea, auto-grow
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
  const [focused, setFocused] = useState(false);
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
        padding: "8px 16px",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Nothing-style label */}
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        MESSAGE HARPER
      </span>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          border: `1px solid ${focused ? "var(--text-primary)" : "var(--border-visible)"}`,
          borderRadius: 8,
          padding: "8px 10px",
          transition: "border-color 150ms ease-out",
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Type here..."
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            fontFamily: "var(--font-body)",
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
    </div>
  );
}
