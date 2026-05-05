// S38-T1: Chat input — tap-hold palette, swipe-up history, slash commands
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type TouchEvent,
} from "react";
import { ArrowUp, Plus, Newspaper, X } from "lucide-react";
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
  /** S38-T1: Callback when user swipes up on empty textarea */
  onRecallLast?: () => void;
}

export default function ChatInput({
  onSend,
  isLoading,
  disabled,
  onRecallLast,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [headlineChips, setHeadlineChips] = useState<HeadlineChip[]>([]);
  const [headlinePickerOpen, setHeadlinePickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── S38-T1: Tap-hold palette ──────────────────────────────────────────
  const [showQuickPalette, setShowQuickPalette] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartYRef = useRef(0);

  const handleTouchStart = useCallback((e: TouchEvent<HTMLTextAreaElement>) => {
    touchStartYRef.current = e.touches[0]?.clientY ?? 0;
    longPressTimerRef.current = setTimeout(() => {
      setShowQuickPalette(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent<HTMLTextAreaElement>) => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      // Swipe-up detection (when textarea is empty)
      const endY = e.changedTouches[0]?.clientY ?? 0;
      const deltaY = touchStartYRef.current - endY;
      if (deltaY > 50 && !text.trim()) {
        // Swipe up on empty textarea — recall last
        if (onRecallLast) onRecallLast();
      }
    },
    [text, onRecallLast],
  );

  // ── S38-T1: Slash command detection ───────────────────────────────────
  const showSlashCommands = text.startsWith("/") && text.length < 20;
  const SLASH_COMMANDS = [
    { cmd: "/oracle", label: "Oracle — All-Seer" },
    { cmd: "/feucht", label: "Feucht — Risk" },
    { cmd: "/consul", label: "Consul — Fundamentals" },
    { cmd: "/herald", label: "Herald — News" },
    { cmd: "/harper", label: "Harper — CAO" },
    { cmd: "/plan", label: "Plan Mode" },
    { cmd: "/stop", label: "Stop Stream" },
  ];

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
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
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
            // 16px prevents iOS Safari from auto-zooming the viewport on focus
            fontSize: 16,
            color: "var(--text-primary)",
            lineHeight: 1.5,
            maxHeight: 96,
            overflow: "auto",
            padding: "14px 16px 8px",
          }}
        />

        {/* S38-T1: Slash command pills */}
        {showSlashCommands && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              padding: "4px 16px 8px",
            }}
          >
            {SLASH_COMMANDS.filter((c) =>
              c.cmd.startsWith(text.split(" ")[0]),
            ).map((c) => (
              <button
                key={c.cmd}
                onClick={() => setText(c.cmd + " ")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(199,159,74,0.25)",
                  background: "rgba(199,159,74,0.08)",
                  color: "var(--accent, #c79f4a)",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {c.cmd}
              </button>
            ))}
          </div>
        )}

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

      {/* S38-T1: Quick palette overlay (tap-hold) */}
      {showQuickPalette && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(5,4,2,0.85)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: "calc(120px + env(safe-area-inset-bottom, 0px))",
          }}
          onClick={() => setShowQuickPalette(false)}
        >
          <div
            style={{
              width: "90%",
              maxWidth: 360,
              maxHeight: "50vh",
              borderRadius: 16,
              border: "1px solid rgba(199,159,74,0.25)",
              background: "#080705",
              overflow: "hidden",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid rgba(199,159,74,0.1)",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--accent, #c79f4a)",
                }}
              >
                Quick Actions
              </span>
              <button
                onClick={() => setShowQuickPalette(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6B7280",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: "8px 0" }}>
              {SLASH_COMMANDS.map((s) => (
                <button
                  key={s.cmd}
                  onClick={() => {
                    setText(s.cmd + " ");
                    setShowQuickPalette(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 16px",
                    background: "none",
                    border: "none",
                    color: "#f0ead6",
                    fontSize: 14,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--accent, #c79f4a)",
                      minWidth: 70,
                    }}
                  >
                    {s.cmd}
                  </span>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
