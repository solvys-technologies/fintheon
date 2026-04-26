// [claude-code 2026-04-25] S42-T2 mobile: wrap in <ComposerPrimitive.Root> (assistant-ui),
//   ↑/↓ history recall on textarea (still useful with Bluetooth keyboards), long-press send
//   to open the queue editor, swipe-up on the composer to open MobileCommandPalette,
//   slash-command persona override + @TICKER injection mirror desktop.
// [claude-code 2026-04-16] Chat input — matches desktop theme: gradient box, accent border, inline toolbar
import {
  useState,
  useRef,
  useCallback,
  type KeyboardEvent,
  useEffect,
} from "react";
import { ComposerPrimitive } from "@assistant-ui/react";
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
  /** Last 10 user-message texts (oldest → newest) for ↑↓ history recall. */
  historyMessages?: string[];
  /** Long-press the send button → open the parent's MessageQueue editor. */
  onLongPressSend?: () => void;
  /** Swipe-up on the composer surface → open the MobileCommandPalette sheet. */
  onSwipeUp?: () => void;
}

const SWIPE_THRESHOLD_PX = 60;
const LONG_PRESS_MS = 500;

export default function ChatInput({
  onSend,
  isLoading,
  disabled,
  historyMessages,
  onLongPressSend,
  onSwipeUp,
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

    // S42-T2 mobile: slash-command persona override → strip prefix + dispatch
    // window event so ChatPage can swap the persona for one turn (mirror of
    // desktop FintheonComposer behavior).
    const slashMatch = trimmed.match(/^\/(oracle|feucht|consul|herald)\s+/i);
    if (slashMatch) {
      const personaId = slashMatch[1].toLowerCase();
      const stripped = trimmed.slice(slashMatch[0].length);
      try {
        window.dispatchEvent(
          new CustomEvent("fintheon:persona-override", {
            detail: { personaId, text: stripped, images },
          }),
        );
      } catch {
        /* ignore */
      }
      setText("");
      setImages([]);
      setHeadlineChips([]);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      return;
    }

    // S42-T2: @TICKER injection — strip mention + append a ticker context line
    // so the assistant gets a uniform "Tickers attached" footer.
    const tickerMatches = Array.from(trimmed.matchAll(/@([A-Z]{1,5})\b/g));
    const tickers = Array.from(new Set(tickerMatches.map((m) => m[1])));
    let outgoing = trimmed;
    if (tickers.length > 0) {
      outgoing = trimmed
        .replace(/@([A-Z]{1,5})\b/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      outgoing += `\n\n---\nTickers attached: ${tickers
        .map((t) => `$${t}`)
        .join(", ")}`;
    }

    const opts: { images?: string[]; riskFlowContext?: string } = {};
    if (images.length > 0) opts.images = images;
    const ctx = formatHeadlineContext(headlineChips);
    if (ctx) opts.riskFlowContext = ctx;
    onSend(outgoing, Object.keys(opts).length > 0 ? opts : undefined);
    setText("");
    setImages([]);
    setHeadlineChips([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    historyIdxRef.current = -1;
    draftBeforeRecallRef.current = "";
  }, [text, isLoading, disabled, onSend, images, headlineChips]);

  // S42-T2 mobile: ↑/↓ history recall (Bluetooth keyboard users; harmless on
  // touch since arrow keys aren't surfaced by the soft keyboard).
  const historyIdxRef = useRef(-1);
  const draftBeforeRecallRef = useRef("");

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
        return;
      }
      const hist = historyMessages ?? [];
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && hist.length > 0) {
        const inRecall = historyIdxRef.current !== -1;
        const empty = text.length === 0;
        if (!empty && !inRecall) return;
        if (e.key === "ArrowUp") {
          e.preventDefault();
          if (!inRecall) {
            draftBeforeRecallRef.current = text;
            historyIdxRef.current = hist.length - 1;
          } else if (historyIdxRef.current > 0) {
            historyIdxRef.current -= 1;
          }
          setText(hist[historyIdxRef.current] ?? "");
        } else if (e.key === "ArrowDown" && inRecall) {
          e.preventDefault();
          if (historyIdxRef.current < hist.length - 1) {
            historyIdxRef.current += 1;
            setText(hist[historyIdxRef.current] ?? "");
          } else {
            historyIdxRef.current = -1;
            setText(draftBeforeRecallRef.current);
            draftBeforeRecallRef.current = "";
          }
        }
      }
    },
    [handleSend, historyMessages, text],
  );

  // S42-T2 mobile: long-press send button → open queue editor.
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const handleSendPressStart = useCallback(() => {
    longPressFiredRef.current = false;
    if (!onLongPressSend) return;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      onLongPressSend();
    }, LONG_PRESS_MS);
  }, [onLongPressSend]);
  const handleSendPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // S42-T2 mobile: swipe-up gesture on the composer surface opens the palette.
  const touchStartYRef = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartYRef.current = e.touches[0].clientY;
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const startY = touchStartYRef.current;
      touchStartYRef.current = null;
      if (startY == null || !onSwipeUp) return;
      const endY = e.changedTouches[0]?.clientY ?? startY;
      if (startY - endY > SWIPE_THRESHOLD_PX) {
        onSwipeUp();
      }
    },
    [onSwipeUp],
  );

  // S42-T2 mobile: composer-fill from MobileCommandPalette "recent" pick.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { text?: string };
      if (typeof detail?.text !== "string") return;
      setText(detail.text);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(detail.text!.length, detail.text!.length);
        }
      });
    };
    window.addEventListener("fintheon:composer-fill", handler);
    return () => window.removeEventListener("fintheon:composer-fill", handler);
  }, []);

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
    <ComposerPrimitive.Root
      onSubmit={(e) => e.preventDefault()}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
            // 16px prevents iOS Safari from auto-zooming the viewport on focus
            fontSize: 16,
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

          {/* Right: Send button. Long-press opens the queue editor (S42-T2). */}
          <button
            onClick={() => {
              if (longPressFiredRef.current) return;
              handleSend();
            }}
            onPointerDown={handleSendPressStart}
            onPointerUp={handleSendPressEnd}
            onPointerCancel={handleSendPressEnd}
            onPointerLeave={handleSendPressEnd}
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
    </ComposerPrimitive.Root>
  );
}
