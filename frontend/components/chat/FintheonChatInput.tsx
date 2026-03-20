import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type ChangeEvent, type ClipboardEvent } from 'react';
import { ArrowUp, Square, Plus, Wrench, Brain, Mic, X, GitBranch, Plug2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface FintheonChatInputProps {
  onSend: (message: string, images: string[]) => void;
  onStop?: () => void;
  onSteer?: (message: string) => void;
  isProcessing?: boolean;
  placeholder?: string;
  thinkHarder: boolean;
  setThinkHarder: (v: boolean) => void;
  onOpenAttach?: () => void;
  onOpenConnectors?: () => void;
  connectorCount?: number;
  onOpenSkills?: () => void;
  onSlashTrigger?: (query: string) => void;
  onSlashDismiss?: () => void;
  onSlashSelect?: (skillId: string) => void;
  addExternalImage?: string | null;
  disabled?: boolean;
  draftKey?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function FintheonChatInput({
  onSend,
  onStop,
  onSteer,
  isProcessing = false,
  placeholder = 'The board awaits your command...',
  thinkHarder,
  setThinkHarder,
  onOpenAttach,
  onOpenConnectors,
  connectorCount = 0,
  onOpenSkills,
  onSlashTrigger,
  onSlashDismiss,
  onSlashSelect,
  addExternalImage,
  disabled = false,
  draftKey = 'fintheon:draft-analysis',
}: FintheonChatInputProps) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [steerText, setSteerText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  /* External image attachment (from attach panel) */
  useEffect(() => {
    if (addExternalImage) {
      setImages((prev) => [...prev, addExternalImage]);
    }
  }, [addExternalImage]);

  /* Auto-resize textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  /* Send */
  const handleSend = useCallback(() => {
    const msg = text.trim();
    if (!msg && images.length === 0) return;
    onSend(msg, images);
    setText('');
    setImages([]);
    localStorage.removeItem(draftKey);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, images, onSend, draftKey]);

  /* Double-space stop & send shortcut */
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

  const handleSteerKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && steerText.trim() && onSteer) {
      e.preventDefault();
      onSteer(steerText.trim());
      setSteerText('');
    }
    if (e.key === 'Escape') setSteerText('');
  };

  return (
    <div className="w-full">
      {/* Steer queue strip — shown while processing */}
      {isProcessing && onSteer && (
        <div className="flex items-center gap-2 mb-2 px-3 h-9 rounded-xl border border-[var(--fintheon-accent)]/20 bg-[#0d0c09]/80 backdrop-blur-sm">
          <GitBranch size={12} className="text-[var(--fintheon-accent)]/50 shrink-0" />
          <input
            type="text"
            value={steerText}
            onChange={(e) => setSteerText(e.target.value)}
            onKeyDown={handleSteerKeyDown}
            placeholder="Steer Harper... (Enter to queue)"
            className="flex-1 bg-transparent text-[12px] text-zinc-300 placeholder:text-zinc-600 focus:outline-none"
          />
          {steerText && (
            <button onClick={() => setSteerText('')} className="text-zinc-600 hover:text-zinc-400 transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Image preview strip */}
      {images.length > 0 && (
        <div className="flex gap-2 mb-2 px-2 overflow-x-auto">
          {images.map((src, idx) => (
            <div key={idx} className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-[var(--fintheon-accent)]/20">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removeImage(idx)}
                className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-black/70 text-white"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main container — 21st-dev-inspired clean shell w/ Fintheon palette */}
      <div
        className={[
          'relative flex flex-col rounded-2xl border transition-all duration-200',
          'backdrop-blur-xl shadow-[0_18px_40px_rgba(0,0,0,0.35)]',
          text
            ? 'border-[var(--fintheon-accent)]/55 ring-1 ring-[var(--fintheon-accent)]/25'
            : 'border-[var(--fintheon-accent)]/20 hover:border-[var(--fintheon-accent)]/35',
          disabled ? 'opacity-50 pointer-events-none' : '',
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
            // Slash-command detection: text starts with /
            if (val.startsWith('/') && !val.includes(' ') && !val.includes('\n')) {
              onSlashTrigger?.(val.slice(1));
            } else {
              onSlashDismiss?.();
            }
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          rows={1}
          className="resize-none bg-transparent text-[13px] text-white placeholder:text-zinc-500 focus:outline-none overflow-y-auto"
          style={{
            padding: '14px 16px 8px',
            maxHeight: '170px',
            lineHeight: '1.5',
          }}
        />

        {/* Bottom bar */}
        <div className="flex items-center justify-between" style={{ padding: '8px 10px 10px' }}>
          {/* Left: Attach + Connectors + Skills */}
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenAttach}
              className="flex items-center justify-center rounded-lg text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
              style={{ width: '32px', height: '32px' }}
              title="Attach"
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              onClick={onOpenConnectors}
              className="relative flex items-center justify-center rounded-lg text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
              style={{ width: '32px', height: '32px' }}
              title="Connectors"
            >
              <Plug2 size={14} />
              {connectorCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--fintheon-accent)] text-[8px] text-[var(--fintheon-bg)] flex items-center justify-center font-bold leading-none">
                  {connectorCount > 9 ? '9+' : connectorCount}
                </span>
              )}
            </button>
            <button
              onClick={onOpenSkills}
              className="flex items-center justify-center rounded-lg text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
              style={{ width: '32px', height: '32px' }}
              title="Skills"
            >
              <Wrench size={14} />
            </button>
          </div>

          {/* Right: Think + Mic + Send — justified right */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setThinkHarder(!thinkHarder)}
              title={thinkHarder ? 'Deep Counsel ON' : 'Deep Counsel OFF'}
              className={`flex items-center justify-center transition-all ${
                thinkHarder
                  ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/15 rounded-lg'
                  : 'text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 rounded-lg'
              }`}
              style={{ width: '32px', height: '32px' }}
            >
              <Brain size={14} />
            </button>
            <button
              type="button"
              className="flex items-center justify-center rounded-lg text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
              style={{ width: '32px', height: '32px' }}
              title="Voice input"
              onClick={() => {
                // Dispatch a click on the header voice orb to toggle voice
                window.dispatchEvent(new CustomEvent('fintheon:voice-toggle'));
              }}
            >
              <Mic size={14} />
            </button>
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
  );
}
