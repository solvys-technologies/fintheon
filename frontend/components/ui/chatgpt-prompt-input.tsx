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
} from 'react';
import {
  ArrowUp,
  Square,
  Plus,
  Mic,
  MicOff,
  X,
  Maximize2,
  Loader2,
  Clock,
  Newspaper,
} from 'lucide-react';
import { FintheonSlashPicker } from '../chat/FintheonSlashPicker';
import { FintheonAttachPopup } from '../chat/FintheonAttachPopup';
import { SkillBadge } from '../chat/SkillBadge';
import { UsageRing } from '../chat/UsageRing';

/* ------------------------------------------------------------------ */
/*  Think Harder SVG — Claude-style sparkle shape                     */
/* ------------------------------------------------------------------ */

const ThinkHarderIcon: FC<{ active: boolean }> = ({ active }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke={active ? 'var(--fintheon-accent)' : 'currentColor'}
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={active ? 'animate-[pulse-icon_1.5s_ease-in-out_infinite]' : 'opacity-50'}
  >
    {/* Sparkle / thinking shape */}
    <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
    <path d="M3.5 3.5l2 2M10.5 10.5l2 2M3.5 12.5l2-2M10.5 5.5l2-2" />
    <circle cx="8" cy="8" r="2" />
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
  // Slots for persona + tools dropdowns
  personaSlot?: React.ReactNode;
  toolsSlot?: React.ReactNode;
  // Boardroom: swap pulsing icon for newspaper RiskFlow picker
  onRiskFlowPick?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function PromptBox({
  onSend,
  onStop,
  isProcessing = false,
  placeholder = 'Message your analysts...',
  thinkHarder,
  setThinkHarder,
  activeSkill,
  onSelectSkill,
  showSkills,
  onToggleSkills,
  disabled = false,
  draftKey = 'fintheon:draft-analysis',
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
  onRiskFlowPick,
}: PromptBoxProps) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [vanishing, setVanishing] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [fullSizeImage, setFullSizeImage] = useState<string | null>(null);
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
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, compact ? 100 : 160)}px`;
  }, [text, compact]);

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
      setText('');
      setImages([]);
      localStorage.removeItem(draftKey);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      setVanishing(false);
    }, 300);
  }, [text, images, onSend, draftKey]);

  /* Keyboard shortcuts */
  const lastSpaceRef = useRef(0);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isProcessing && onStop) {
        onStop();
      } else {
        handleSend();
      }
      return;
    }
    if (e.key === ' ' && isProcessing && onStop) {
      const now = Date.now();
      if (now - lastSpaceRef.current < 400) {
        e.preventDefault();
        onStop();
      }
      lastSpaceRef.current = now;
    }
  };

  /* Paste image support */
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              setImages((prev) => [...prev, reader.result as string]);
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAttachImage = useCallback((dataUrl: string) => {
    setImages((prev) => [...prev, dataUrl]);
  }, []);

  const handleSlashSelect = useCallback((skillId: string) => {
    onSelectSkill(skillId);
    setSlashQuery(null);
    setText('');
  }, [onSelectSkill]);

  const micListening = voiceState === 'listening';

  /* RiskFlow drag-drop */
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const json = e.dataTransfer.getData('application/x-riskflow');
    if (!json) return;
    try {
      const data = JSON.parse(json) as { headline?: string; summary?: string; ticker?: string; direction?: string };
      const parts: string[] = [];
      if (data.headline) parts.push(data.headline);
      if (data.ticker) parts.push(`Ticker: ${data.ticker}`);
      if (data.direction) parts.push(`Direction: ${data.direction}`);
      if (data.summary && data.summary !== data.headline) parts.push(data.summary);
      if (parts.length > 0) {
        setText((prev) => (prev ? `${prev}\n\n${parts.join('\n')}` : parts.join('\n')));
      }
    } catch {
      // Not valid riskflow data — ignore
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-riskflow')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const visibleQueueJobs = (queueJobs ?? []).filter((j) => j.status !== 'done').slice(0, 2);

  return (
    <div
      className="pt-4 pb-4 px-4 bg-[linear-gradient(180deg,rgba(5,5,0,0.15),rgba(5,5,0,0.88))] backdrop-blur-xl"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="relative w-full max-w-3xl mx-auto">
        {/* Active skill badge */}
        {activeSkill && (
          <div className="mb-2">
            <SkillBadge skillId={activeSkill} onDismiss={() => onSelectSkill(null)} />
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
        />


        {/* Image preview strip */}
        {images.length > 0 && (
          <div className="flex gap-2 mb-2 px-2 overflow-x-auto">
            {images.map((src, idx) => (
              <div key={idx} className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-[var(--fintheon-accent)]/20 cursor-pointer" onClick={() => setFullSizeImage(src)}>
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                  className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-black/70 text-white"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Queue chips (max 2) */}
        {visibleQueueJobs.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2">
            {visibleQueueJobs.map((job) => (
              <span
                key={job.jobId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--fintheon-accent)]/20 bg-[#0d0c09]/80 text-[11px] text-zinc-400"
              >
                {job.status === 'processing' ? (
                  <Loader2 size={10} className="animate-spin text-[var(--fintheon-accent)]" />
                ) : (
                  <Clock size={10} className="text-zinc-600" />
                )}
                <span>{job.status === 'processing' ? 'Running' : `Queue #${job.position}`}</span>
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
          </div>
        )}

        {/* Drag-over indicator */}
        {dragOver && (
          <div className="mb-2 rounded-xl border-2 border-dashed border-[var(--fintheon-accent)]/40 bg-[var(--fintheon-accent)]/5 px-4 py-3 text-center text-[12px] text-[var(--fintheon-accent)]/70">
            Drop RiskFlow alert here
          </div>
        )}

        {/* Main input container */}
        <div
          className={[
            'relative flex flex-col rounded-2xl border transition-all duration-200',
            'backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)]',
            text
              ? 'border-[var(--fintheon-accent)]/55 ring-1 ring-[var(--fintheon-accent)]/25'
              : 'border-[var(--fintheon-accent)]/20 hover:border-[var(--fintheon-accent)]/35',
            disabled ? 'opacity-50 pointer-events-none' : '',
            vanishing ? 'animate-prompt-vanish' : '',
          ].join(' ')}
          style={{ background: 'linear-gradient(180deg, rgba(13,12,9,0.98), rgba(8,8,6,0.95))' }}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              const val = e.target.value;
              setText(val);
              // Slash-command detection
              if (val.startsWith('/') && !val.includes(' ') && !val.includes('\n')) {
                setSlashQuery(val.slice(1));
              } else {
                setSlashQuery(null);
              }
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            rows={1}
            className="resize-none bg-transparent text-[13px] text-white placeholder:text-zinc-500 focus:outline-none overflow-y-auto"
            style={{
              padding: compact ? '10px 14px 6px' : '14px 16px 8px',
              maxHeight: compact ? '100px' : '170px',
              lineHeight: '1.5',
            }}
          />

          {/* Bottom bar */}
          <div className="flex items-center justify-between" style={{ padding: compact ? '6px 8px 8px' : '8px 10px 10px' }}>
            {/* Left toolbar */}
            <div className="flex items-center gap-1">
              {/* Attach */}
              <button
                onClick={() => setShowAttach((v) => !v)}
                className="flex items-center justify-center rounded-lg text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
                style={{ width: '32px', height: '32px' }}
                title="Attach"
              >
                <Plus size={16} />
              </button>

              {/* Tools (combined Skills + Connectors) */}
              {toolsSlot}

              {/* Boardroom: newspaper RiskFlow picker | Others: pulsing icon toggle */}
              {onRiskFlowPick ? (
                <button
                  onClick={onRiskFlowPick}
                  title="Import RiskFlow items"
                  className="flex items-center justify-center rounded-lg transition-all text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10"
                  style={{ width: '32px', height: '32px' }}
                >
                  <Newspaper size={14} />
                </button>
              ) : (
                <button
                  onClick={() => setThinkHarder(!thinkHarder)}
                  title={thinkHarder ? 'Extended thinking ON' : 'Extended thinking OFF'}
                  className="flex items-center justify-center rounded-lg transition-all text-zinc-500 hover:text-[var(--fintheon-accent)]"
                  style={{ width: '32px', height: '32px' }}
                >
                  <ThinkHarderIcon active={thinkHarder} />
                </button>
              )}
            </div>

            {/* Right: Persona + Usage + Send/Stop */}
            <div className="flex items-center gap-2">
              {personaSlot}
              <UsageRing />
              <button
              onClick={isProcessing && onStop ? onStop : handleSend}
              disabled={!text.trim() && images.length === 0 && !isProcessing}
              className={`flex items-center justify-center rounded-full transition-all ${
                isProcessing
                  ? 'bg-[var(--fintheon-accent)] hover:bg-[#C5A030] text-black'
                  : 'bg-[var(--fintheon-accent)] hover:bg-[#C5A030] text-black disabled:opacity-30 disabled:hover:bg-[var(--fintheon-accent)] shadow-[0_8px_20px_rgba(212,175,55,0.25)]'
              }`}
              style={{ width: '34px', height: '34px' }}
              title={isProcessing ? 'Stop' : 'Send'}
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
            <img src={fullSizeImage} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl" />
            <button
              onClick={() => { dialogRef.current?.close(); setFullSizeImage(null); }}
              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X size={16} />
            </button>
            <button
              onClick={() => window.open(fullSizeImage, '_blank')}
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
