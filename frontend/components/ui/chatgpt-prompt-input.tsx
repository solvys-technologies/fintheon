// [claude-code 2026-04-18] Composer polish: (1) IME composition guard on Enter so submitting an
//   IME candidate with Enter no longer sends the message mid-composition; (2) Attach popup auto-
//   dismisses when the user starts typing; (3) Queue chips show "+N more" hint when > 2 jobs
//   are active (was silent truncation); (4) Compact mode bottom-bar padding bumped to match the
//   main composer so the send button no longer crowds the Harper pill; (5) Paste handler logs
//   a one-time note when non-image clipboard items are dropped (was silent).
// [claude-code 2026-03-28] S8-T7: Pulsing icon (replaces Think Harder), no bg/border when active
// [claude-code 2026-03-11] T5: steer strip removed, queue chips added, RiskFlow drag-drop
// [claude-code 2026-03-22] Track 4: persona/tools slots, icon-only Think, removed Plug2+Wrench
// Based on 21st.dev ChatGPT prompt input, rewritten without Radix
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
  type ClipboardEvent,
  type FC,
} from "react";
import {
  ArrowUp,
  Square,
  Plus,
  Mic,
  MicOff,
  X,
  Maximize2,
  Clock,
} from "lucide-react";
import { SolvysLoader } from "../shared/SolvysLoader";
import { FintheonSlashPicker } from "../chat/FintheonSlashPicker";
import {
  FintheonAttachPopup,
  type HeadlineAttachment,
} from "../chat/FintheonAttachPopup";
import { SkillBadge } from "../chat/SkillBadge";
import { UsageRing } from "../chat/UsageRing";
import {
  HeadlineChips,
  type HeadlineChip,
} from "../chat/HeadlinePickerPopover";
import type { RiskFlowAlert } from "../../lib/riskflow-feed";

/* ------------------------------------------------------------------ */
/*  RiskFlow preview builder                                          */
/* ------------------------------------------------------------------ */

function buildRiskFlowPreview(data: {
  headline?: string;
  summary?: string;
  ticker?: string;
  direction?: string;
  source?: string;
  ivScore?: number;
  publishedAt?: string;
}): string | null {
  if (!data.headline) return null;
  const parts: string[] = [];
  parts.push(`[RiskFlow Context]`);
  parts.push(`Headline: ${data.headline}`);
  if (data.source) parts.push(`Source: ${data.source}`);
  if (data.ivScore != null) parts.push(`IV Score: ${data.ivScore.toFixed(1)}`);
  if (data.ticker) parts.push(`Ticker: ${data.ticker}`);
  if (data.direction) parts.push(`Direction: ${data.direction}`);
  if (data.publishedAt) {
    const ago = Math.round(
      (Date.now() - new Date(data.publishedAt).getTime()) / 60000,
    );
    parts.push(`Time: ${ago}m ago`);
  }
  if (data.summary && data.summary !== data.headline) {
    parts.push(`Summary: ${data.summary}`);
  }
  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Deep Research icon                                                */
/* ------------------------------------------------------------------ */

const ThinkHarderIcon: FC<{ active: boolean }> = ({ active }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke={active ? "var(--fintheon-accent)" : "currentColor"}
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={
      active ? "animate-[pulse-icon_1.5s_ease-in-out_infinite]" : "opacity-50"
    }
  >
    <circle cx="8" cy="8" r="4.5" />
    <circle cx="8" cy="8" r="2.2" />
    <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface PromptBoxProps {
  onSend: (message: string, images?: string[]) => void;
  onStop?: () => void;
  isProcessing?: boolean;
  placeholder?: string;
  thinkHarder: boolean;
  setThinkHarder: (v: boolean) => void;
  activeSkill: string | null;
  onSelectSkill: (id: string | null) => void;
  showSkills: boolean;
  onToggleSkills: () => void;
  onSlashSelect?: (skillId: string) => void;
  disabled?: boolean;
  draftKey?: string;
  compact?: boolean;
  lastError?: string | null;
  disabledSkills?: Record<string, { reason: string }>;
  // Voice
  voiceEnabled?: boolean;
  voiceState?: string;
  onToggleVoice?: () => void;
  // Queue chips
  queueJobs?: Array<{ jobId: string; status: string; position: number }>;
  onCancelJob?: (jobId: string) => void;
  // Slots for persona + tools + provider dropdowns
  personaSlot?: React.ReactNode;
  toolsSlot?: React.ReactNode;
  providerSlot?: React.ReactNode;
  // S60-T3: Modal-aware slots for plugin + MCP triggers (composer toolbar)
  pluginSlot?: React.ReactNode;
  mcpSlot?: React.ReactNode;
  // Relay dispatch button (leftmost in action cluster). Renders either relay or disconnect.
  relaySlot?: React.ReactNode;
  // Optional banner shown above the input while dispatched (e.g. "Chatting on iPhone").
  dispatchBanner?: React.ReactNode;
  // Todo + Queue drawer toggle button
  todoSlot?: React.ReactNode;
  // Boardroom: swap pulsing icon for newspaper RiskFlow picker
  onRiskFlowPick?: () => void;
  // Hide the Think Harder toggle (used in Agentic Forum where deep-research is always on)
  hideThinkHarder?: boolean;
  // Headline attachment (multi-select from scored feed items)
  headlineAlerts?: RiskFlowAlert[];
  headlineChips?: HeadlineChip[];
  onHeadlineToggle?: (chip: HeadlineChip) => void;
  onHeadlineClear?: () => void;
  // S38-T1: History navigation
  recallText?: string | null;
  onRecallConsumed?: () => void;
  onHistoryUp?: () => void;
  onHistoryDown?: () => void;
  onHistoryEscape?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function PromptBox({
  onSend,
  onStop,
  isProcessing = false,
  placeholder = "Message your analysts...",
  thinkHarder,
  setThinkHarder,
  activeSkill,
  onSelectSkill,
  showSkills,
  onToggleSkills,
  disabled = false,
  draftKey = "fintheon:draft-analysis",
  compact = false,
  lastError,
  disabledSkills,
  voiceEnabled,
  voiceState,
  onToggleVoice,
  queueJobs,
  onCancelJob,
  personaSlot,
  toolsSlot,
  providerSlot,
  pluginSlot,
  mcpSlot,
  relaySlot,
  dispatchBanner,
  onRiskFlowPick,
  headlineAlerts,
  headlineChips,
  onHeadlineToggle,
  onHeadlineClear,
  hideThinkHarder,
  recallText,
  onRecallConsumed,
  onHistoryUp,
  onHistoryDown,
  onHistoryEscape,
  todoSlot,
}: PromptBoxProps) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [vanishing, setVanishing] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [fullSizeImage, setFullSizeImage] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  // IME composition state — blocks Enter-to-send while a candidate is being composed.
  const isComposingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  /* Draft persistence — load on mount */
  useEffect(() => {
    const draft = localStorage.getItem(draftKey);
    if (draft) setText(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Draft persistence — save on change */
  useEffect(() => {
    if (text) {
      localStorage.setItem(draftKey, text);
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [text, draftKey]);

  /* Auto-resize textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, compact ? 100 : 160)}px`;
  }, [text, compact]);

  /* S38-T1: Sync recalled history text into textarea */
  useEffect(() => {
    if (recallText !== null && recallText !== undefined) {
      setText(recallText);
      onRecallConsumed?.();
    }
  }, [recallText]);

  /* Full-size image dialog */
  useEffect(() => {
    if (fullSizeImage) {
      dialogRef.current?.showModal();
    }
  }, [fullSizeImage]);

  /* Send with vanish animation */
  const handleSend = useCallback(() => {
    const msg = text.trim();
    if (!msg && images.length === 0) return;

    // Trigger vanish animation
    setVanishing(true);
    setTimeout(() => {
      onSend(msg, images.length > 0 ? images : undefined);
      setText("");
      setImages([]);
      localStorage.removeItem(draftKey);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      setVanishing(false);
    }, 300);
  }, [text, images, onSend, draftKey]);

  /* Keyboard shortcuts */
  const lastSpaceRef = useRef(0);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // IME composition: Enter commits a candidate — don't send the message.
      // (Chromium also sets e.keyCode === 229 during composition; we keep a ref for safety.)
      if (isComposingRef.current || e.nativeEvent.isComposing) return;
      e.preventDefault();
      if (isProcessing && onStop) {
        onStop();
      } else {
        handleSend();
      }
      return;
    }
    if (e.key === " " && isProcessing && onStop) {
      const now = Date.now();
      if (now - lastSpaceRef.current < 400) {
        e.preventDefault();
        onStop();
      }
      lastSpaceRef.current = now;
    }
    // S38-T1: Arrow history navigation
    if (e.key === "ArrowUp" && !text.trim() && onHistoryUp) {
      e.preventDefault();
      onHistoryUp();
    }
    if (e.key === "ArrowDown" && onHistoryDown) {
      e.preventDefault();
      onHistoryDown();
    }
    if (e.key === "Escape" && onHistoryEscape) {
      e.preventDefault();
      onHistoryEscape();
    }
  };

  /* Paste image support */
  const pasteWarnedRef = useRef(false);
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    let handledImage = false;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        handledImage = true;
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              setImages((prev) => [...prev, reader.result as string]);
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    }
    if (!handledImage && items.length > 0 && !pasteWarnedRef.current) {
      // One-time log so we're not silent about dropped non-image clipboard payloads
      // (files, html fragments, etc). Most such pastes land as text via the default path.
      const nonImageTypes = Array.from(items)
        .map((it) => it.type || "<unknown>")
        .join(", ");
      console.debug(
        "[PromptBox] Non-image clipboard item(s) ignored by image handler:",
        nonImageTypes,
      );
      pasteWarnedRef.current = true;
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAttachImage = useCallback((dataUrl: string) => {
    setImages((prev) => [...prev, dataUrl]);
  }, []);

  const handleSlashSelect = useCallback(
    (skillId: string) => {
      onSelectSkill(skillId);
      setSlashQuery(null);
      setText("");
    },
    [onSelectSkill],
  );

  const micListening = voiceState === "listening";

  /* RiskFlow drag-drop */
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const json = e.dataTransfer.getData("application/x-riskflow");
    if (!json) return;
    try {
      const data = JSON.parse(json) as {
        headline?: string;
        summary?: string;
        ticker?: string;
        direction?: string;
        source?: string;
        ivScore?: number;
        publishedAt?: string;
      };
      const preview = buildRiskFlowPreview(data);
      if (preview) {
        setText((prev) => (prev ? `${prev}\n\n${preview}` : preview));
      }
    } catch {
      // Not valid riskflow data — ignore
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-riskflow")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const activeQueueJobs = (queueJobs ?? []).filter((j) => j.status !== "done");
  const visibleQueueJobs = activeQueueJobs.slice(0, 2);
  const hiddenQueueCount = Math.max(0, activeQueueJobs.length - 2);

  return (
    <div
      className="pt-4 pb-4 px-4"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="relative w-full max-w-3xl mx-auto">
        {/* Active skill badge */}
        {activeSkill && (
          <div className="mb-2">
            <SkillBadge
              skillId={activeSkill}
              onDismiss={() => onSelectSkill(null)}
            />
          </div>
        )}

        {/* Slash-command picker */}
        {slashQuery !== null && (
          <FintheonSlashPicker
            query={slashQuery}
            onSelect={handleSlashSelect}
            onDismiss={() => setSlashQuery(null)}
            onStop={onStop}
            disabledSkills={disabledSkills}
          />
        )}

        {/* Error banner */}
        {lastError && (
          <div className="mb-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {lastError}
          </div>
        )}

        {/* Attach panel */}
        <FintheonAttachPopup
          open={showAttach}
          onClose={() => setShowAttach(false)}
          onAttachImage={handleAttachImage}
          onAttachDocument={({ filename, text }) => {
            const attached = `\n\n[Attached Document: ${filename}]\n${text}`;
            setText((prev) => `${prev}${attached}`);
            setShowAttach(false);
          }}
          riskflowAlerts={headlineAlerts}
          onAttachHeadlines={(items: HeadlineAttachment[]) => {
            if (onHeadlineToggle) {
              items.forEach((item) =>
                onHeadlineToggle({
                  id: item.id,
                  headline: item.headline,
                  severity: item.severity,
                  direction: item.direction,
                }),
              );
            }
          }}
        />

        {/* Image preview strip */}
        {images.length > 0 && (
          <div className="flex gap-2 mb-2 px-2 overflow-x-auto">
            {images.map((src, idx) => (
              <div
                key={idx}
                className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-[var(--fintheon-accent)]/20 cursor-pointer"
                onClick={() => setFullSizeImage(src)}
              >
                <img
                  src={src}
                  alt=""
                  className="w-full h-full object-contain"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(idx);
                  }}
                  className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-black/70 text-white"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Queue chips (max 2 + overflow hint) */}
        {visibleQueueJobs.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2">
            {visibleQueueJobs.map((job) => (
              <span
                key={job.jobId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--fintheon-accent)]/20 bg-[#0d0c09]/80 text-[11px] text-[#f0ead6]/60"
              >
                {job.status === "processing" ? (
                  <SolvysLoader size={10} />
                ) : (
                  <Clock size={10} className="text-zinc-600" />
                )}
                <span>
                  {job.status === "processing"
                    ? "Running"
                    : `Queue #${job.position}`}
                </span>
                {onCancelJob && (
                  <button
                    onClick={() => onCancelJob(job.jobId)}
                    className="ml-0.5 text-zinc-600 hover:text-red-400 transition-colors"
                    title="Cancel"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            ))}
            {hiddenQueueCount > 0 && (
              <span
                className="inline-flex items-center px-2 py-1 rounded border border-[var(--fintheon-accent)]/10 bg-[#0d0c09]/60 text-[10px] text-[#f0ead6]/40"
                title={`${hiddenQueueCount} more job(s) queued`}
              >
                +{hiddenQueueCount} more
              </span>
            )}
          </div>
        )}

        {/* Drag-over indicator */}
        {dragOver && (
          <div className="mb-2 rounded-xl border-2 border-dashed border-[var(--fintheon-accent)]/40 bg-[var(--fintheon-accent)]/5 px-4 py-3 text-center text-[12px] text-[var(--fintheon-accent)]/70">
            Drop RiskFlow alert here
          </div>
        )}

        {/* Dispatch banner — shown above the input while a mirror session is active */}
        {dispatchBanner}

        {/* Main input container */}
        <div
          className={[
            "relative flex flex-col rounded-2xl border",
            "backdrop-blur-xl",
            focused
              ? "border-[var(--fintheon-accent)]/55"
              : text
                ? "border-[var(--fintheon-accent)]/40"
                : "border-[var(--fintheon-accent)]/10 hover:border-[var(--fintheon-accent)]/25",
            disabled ? "opacity-50 pointer-events-none" : "",
            vanishing ? "animate-prompt-vanish" : "",
          ].join(" ")}
          style={{
            background: focused || text ? "rgba(13,12,9,0.98)" : "transparent",
            transition: "border-color 0.2s ease, background 0.2s ease",
          }}
        >
          {/* Headline chips above textarea */}
          {headlineChips && headlineChips.length > 0 && onHeadlineToggle && (
            <HeadlineChips
              chips={headlineChips}
              onRemove={(id) => {
                const chip = headlineChips.find((c) => c.id === id);
                if (chip) onHeadlineToggle(chip);
              }}
            />
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              const val = e.target.value;
              setText(val);
              // Auto-dismiss the attach popup once the user starts composing a message —
              // otherwise the popup hangs over the input and blocks the first word or two.
              if (val.length > 0 && showAttach) setShowAttach(false);
              // Slash-command detection
              if (
                val.startsWith("/") &&
                !val.includes(" ") &&
                !val.includes("\n")
              ) {
                setSlashQuery(val.slice(1));
              } else {
                setSlashQuery(null);
              }
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            placeholder={placeholder}
            rows={1}
            className="resize-none bg-transparent text-[13px] text-[#f0ead6] placeholder:text-zinc-500 focus:outline-none overflow-y-auto"
            style={{
              padding: compact ? "10px 14px 6px" : "14px 16px 8px",
              maxHeight: compact ? "100px" : "170px",
              lineHeight: "1.5",
            }}
          />

          {/* Bottom bar — compact padding matches main composer so the send button
              doesn't crowd the Harper/provider pill in the sidebar chat. */}
          <div
            className="flex items-center justify-between"
            style={{ padding: compact ? "6px 8px 6px" : "8px 10px 10px" }}
          >
            {/* Left toolbar */}
            <div className="flex items-center gap-1">
              {/* Relay dispatch (leftmost) — S21-T1 */}
              {relaySlot}

              {/* Attach */}
              <button
                onClick={() => setShowAttach((v) => !v)}
                className="flex items-center justify-center rounded-lg text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
                style={{ width: "32px", height: "32px" }}
                title="Attach"
              >
                <Plus size={16} />
              </button>

              {/* Plugins (S60-T3: modal trigger) */}
              {pluginSlot}

              {/* MCP Connectors (S60-T3: modal trigger) */}
              {mcpSlot}

              {/* Tools (combined Skills + Connectors — legacy, used when pluginSlot/mcpSlot not provided) */}
              {toolsSlot}

              {/* Think Harder toggle */}
              {!hideThinkHarder && (
                <button
                  onClick={() => setThinkHarder(!thinkHarder)}
                  title={thinkHarder ? "Deep Research ON" : "Deep Research OFF"}
                  className="flex items-center justify-center rounded-lg transition-all text-zinc-500 hover:text-[var(--fintheon-accent)]"
                  style={{ width: "32px", height: "32px" }}
                >
                  <ThinkHarderIcon active={thinkHarder} />
                </button>
              )}

              {/* Todo + Queue drawer toggle */}
              {todoSlot}
            </div>

            {/* Right: Persona + Usage + Send/Stop */}
            <div className="flex items-center gap-2">
              {providerSlot}
              {personaSlot}
              <UsageRing />
              <button
                onClick={isProcessing && onStop ? onStop : handleSend}
                disabled={!text.trim() && images.length === 0 && !isProcessing}
                className={`flex items-center justify-center rounded-full ${
                  isProcessing
                    ? "bg-[var(--fintheon-accent)]/80 hover:bg-[var(--fintheon-accent)] text-black"
                    : text.trim() || focused
                      ? "bg-[var(--fintheon-accent)] hover:bg-[#C5A030] text-black"
                      : "bg-[var(--fintheon-accent)]/30 text-black/50 disabled:opacity-20"
                }`}
                style={{
                  width: "34px",
                  height: "34px",
                  transition: "all 1.3s ease",
                }}
                title={isProcessing ? "Stop" : "Send"}
              >
                {isProcessing ? (
                  <Square size={12} fill="currentColor" />
                ) : (
                  <ArrowUp size={16} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full-size image dialog (native <dialog>) */}
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) {
            dialogRef.current?.close();
            setFullSizeImage(null);
          }
        }}
        onClose={() => setFullSizeImage(null)}
        className="bg-transparent backdrop:bg-black/80 max-w-[90vw] max-h-[90vh] p-0 rounded-xl"
      >
        {fullSizeImage && (
          <div className="relative">
            <img
              src={fullSizeImage}
              alt=""
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl"
            />
            <button
              onClick={() => {
                dialogRef.current?.close();
                setFullSizeImage(null);
              }}
              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X size={16} />
            </button>
            <button
              onClick={() => window.open(fullSizeImage, "_blank")}
              className="absolute top-2 right-12 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              title="Open in new tab"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}
