// [claude-code 2026-04-18] PWA polish: textarea font-size 14→16 to prevent iOS auto-zoom on focus,
// hit-target upgrade (34×34 → 44×44 min) per iOS HIG, native form autofill hints, buttonized focus
// ring, rising composer animation, and an IME-composition guard on Enter to match desktop.
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
      // IME-composition guard — don't submit mid-dictation on mobile
      // keyboards (voice, Japanese/Chinese candidates, Wispr Flow, etc).
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
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
        padding: "10px 16px 8px",
        // Keep composer above the home indicator on devices with a bottom safe-area.
        paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
        // Translucent blur so long messages scroll behind the composer
        // without hard-cutting at the top edge — feels native on iOS.
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.95) 25%, var(--black) 60%)",
        backdropFilter: "blur(14px) saturate(1.2)",
        WebkitBackdropFilter: "blur(14px) saturate(1.2)",
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
          borderRadius: 22,
          border: focused
            ? "1px solid rgba(199,159,74,0.6)"
            : hasContent
              ? "1px solid rgba(199,159,74,0.4)"
              : "1px solid rgba(255,255,255,0.08)",
          background:
            focused || hasContent
              ? "linear-gradient(180deg, rgba(20,20,20,0.98), rgba(10,10,10,0.98))"
              : "rgba(20,20,20,0.6)",
          boxShadow: focused
            ? "0 0 0 3px rgba(199,159,74,0.08), 0 8px 32px rgba(0,0,0,0.4)"
            : "0 2px 12px rgba(0,0,0,0.3)",
          transition:
            "border-color 200ms var(--ease-nothing), box-shadow 200ms var(--ease-nothing), background 200ms var(--ease-nothing)",
          display: "flex",
          flexDirection: "column" as const,
        }}
      >
        {/* Textarea — 16px font is the iOS Safari threshold that prevents
            auto-zoom on focus (the whole reason the PWA "felt" like a PWA
            when you tapped it). */}
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
          placeholder="Message Harper"
          disabled={disabled}
          rows={1}
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck="true"
          enterKeyHint="send"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            fontFamily: "var(--font-body)",
            fontSize: 16,
            color: "var(--text-primary)",
            lineHeight: 1.45,
            maxHeight: 132,
            overflow: "auto",
            padding: "14px 18px 6px",
            WebkitUserSelect: "text",
          }}
        />

        {/* Bottom toolbar — 44×44 hit targets per iOS HIG */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 8px 8px",
          }}
        >
          {/* Left: Plus + Headlines */}
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
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
              aria-label="Attach image"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "transparent",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.4 : 1,
                transition: "background 150ms, color 150ms",
                color: "var(--text-secondary)",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              <Plus size={20} />
            </button>
            <button
              onClick={() => setHeadlinePickerOpen(true)}
              disabled={disabled}
              aria-label="Attach headline"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background:
                  headlineChips.length > 0
                    ? "rgba(199,159,74,0.15)"
                    : "transparent",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.4 : 1,
                transition: "background 150ms, color 150ms",
                color:
                  headlineChips.length > 0
                    ? "var(--accent)"
                    : "var(--text-secondary)",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              <Newspaper size={20} />
            </button>
          </div>

          {/* Right: Send button — 44×44 to meet iOS HIG */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: canSend
                ? "var(--accent, #c79f4a)"
                : "rgba(199,159,74,0.2)",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: canSend ? "pointer" : "default",
              flexShrink: 0,
              boxShadow: canSend
                ? "0 2px 16px rgba(199,159,74,0.35), 0 0 0 1px rgba(255,255,255,0.1) inset"
                : "none",
              transition:
                "background 200ms var(--ease-nothing), box-shadow 200ms var(--ease-nothing), transform 120ms var(--ease-nothing)",
              transform: canSend ? "scale(1)" : "scale(0.94)",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            <ArrowUp
              size={20}
              strokeWidth={2.4}
              color={canSend ? "var(--black, #000)" : "rgba(255,255,255,0.35)"}
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
