// [claude-code 2026-04-16] T2: Chat input with toolbar — image attach, headline picker, expanded onSend
import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { ArrowUp, Newspaper } from "lucide-react";
import { ImageAttachButton } from "./ImageAttachButton";
import { ImagePreviewRow } from "./ImagePreviewRow";
import { HeadlineChips, formatHeadlineContext } from "./HeadlineChips";
import type { HeadlineChip } from "./HeadlineChips";
import { HeadlinePickerSheet } from "./HeadlinePickerSheet";

interface ChatInputProps {
  onSend: (
    text: string,
    opts?: { images?: string[]; riskFlowContext?: string },
  ) => void;
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
  const [images, setImages] = useState<string[]>([]);
  const [headlineChips, setHeadlineChips] = useState<HeadlineChip[]>([]);
  const [headlinePickerOpen, setHeadlinePickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || disabled) return;
    const opts: { images?: string[]; riskFlowContext?: string } = {};
    if (images.length > 0) opts.images = images;
    const ctx = formatHeadlineContext(headlineChips);
    if (ctx) opts.riskFlowContext = ctx;
    onSend(trimmed, Object.keys(opts).length > 0 ? opts : undefined);
    setText("");
    setImages([]);
    setHeadlineChips([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [text, isLoading, disabled, onSend, images, headlineChips]);

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

  const handleToggleChip = useCallback((chip: HeadlineChip) => {
    setHeadlineChips((prev) => {
      const exists = prev.find((c) => c.id === chip.id);
      return exists ? prev.filter((c) => c.id !== chip.id) : [...prev, chip];
    });
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

      {/* Toolbar row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ImageAttachButton
          onAdd={(uri) => setImages((prev) => [...prev, uri])}
          imageCount={images.length}
          disabled={disabled}
        />
        <button
          onClick={() => setHeadlinePickerOpen(true)}
          disabled={disabled}
          aria-label="Attach headlines"
          style={{
            background: "transparent",
            border: "none",
            padding: 6,
            cursor: disabled ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: disabled ? 0.4 : 1,
          }}
        >
          <Newspaper size={20} color="var(--text-secondary)" />
        </button>
      </div>

      {/* Attachment previews */}
      <ImagePreviewRow
        images={images}
        onRemove={(i) =>
          setImages((prev) => prev.filter((_, idx) => idx !== i))
        }
      />
      <HeadlineChips
        chips={headlineChips}
        onRemove={(id) =>
          setHeadlineChips((prev) => prev.filter((c) => c.id !== id))
        }
      />

      {/* Input border box */}
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

      {/* Headline picker bottom sheet */}
      <HeadlinePickerSheet
        open={headlinePickerOpen}
        onClose={() => setHeadlinePickerOpen(false)}
        selected={headlineChips}
        onToggle={handleToggleChip}
        onClear={() => setHeadlineChips([])}
      />
    </div>
  );
}
