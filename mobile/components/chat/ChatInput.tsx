// [claude-code 2026-04-16] Chat input — matches desktop theme: gradient box, accent border, inline toolbar
import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { ArrowUp, Plus, Newspaper } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || file.size > 5 * 1024 * 1024) {
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setImages((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [],
  );

  const canSend = text.trim().length > 0 && !isLoading && !disabled;
  const hasContent = text.length > 0 || focused;

  return (
    <div
      style={{
        padding: "8px 16px",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Attachment previews above the input box */}
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

      {/* Main input container — matches desktop chatgpt-prompt-input */}
      <div
        style={{
          borderRadius: 16,
          border: focused
            ? "1px solid rgba(199,159,74,0.55)"
            : hasContent
              ? "1px solid rgba(199,159,74,0.4)"
              : "1px solid rgba(199,159,74,0.1)",
          background:
            focused || hasContent
              ? "linear-gradient(180deg, rgba(13,12,9,0.98), rgba(8,8,6,0.95))"
              : "transparent",
          boxShadow: focused
            ? "0 0 20px rgba(199,159,74,0.18), 0 0 40px rgba(199,159,74,0.08)"
            : "none",
          transition: "all 0.4s ease",
          display: "flex",
          flexDirection: "column" as const,
        }}
      >
        {/* Textarea */}
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
          placeholder="Message Harper..."
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
            padding: "14px 16px 8px",
          }}
        />

        {/* Bottom toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 10px 10px",
          }}
        >
          {/* Left: Plus + Headlines */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || images.length >= 4}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "transparent",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.4 : 1,
                transition: "color 150ms",
                color: "var(--text-secondary)",
              }}
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => setHeadlinePickerOpen(true)}
              disabled={disabled}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "transparent",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.4 : 1,
                transition: "color 150ms",
                color: "var(--text-secondary)",
              }}
            >
              <Newspaper size={16} />
            </button>
          </div>

          {/* Right: Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: canSend
                ? "var(--accent, #c79f4a)"
                : "rgba(199,159,74,0.3)",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: canSend ? "pointer" : "default",
              flexShrink: 0,
              boxShadow: canSend ? "0 0 20px rgba(199,159,74,0.4)" : "none",
              transition: "all 0.4s ease",
            }}
          >
            <ArrowUp
              size={18}
              color={canSend ? "var(--black, #000)" : "rgba(0,0,0,0.5)"}
            />
          </button>
        </div>
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
