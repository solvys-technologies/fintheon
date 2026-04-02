// [claude-code 2026-03-28] S8-T7: Animated AI input adapted from 21st.dev/kokonutd
// Used across Chat interfaces — lightweight, animated persona/model switcher input
import { useState, useRef, useCallback, useEffect, type FC, type KeyboardEvent } from 'react';
import { ArrowUp, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Auto-resize textarea hook                                          */
/* ------------------------------------------------------------------ */

function useAutoResizeTextarea({ minHeight, maxHeight }: { minHeight: number; maxHeight?: number }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }
      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight ?? Infinity));
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight],
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) textarea.style.height = `${minHeight}px`;
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AnimatedAiInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Agent/persona list — label + optional icon node */
  agents?: Array<{ id: string; label: string; icon?: React.ReactNode }>;
  /** Currently selected agent id */
  activeAgentId?: string;
  /** Called when user picks a different agent */
  onAgentChange?: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const AnimatedAiInput: FC<AnimatedAiInputProps> = ({
  onSend,
  placeholder = 'Message Harper-Opus...',
  disabled = false,
  agents = [],
  activeAgentId,
  onAgentChange,
}) => {
  const [value, setValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 48, maxHeight: 260 });

  const selectedAgent = agents.find((a) => a.id === activeAgentId) ?? agents[0];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    adjustHeight(true);
  }, [value, disabled, onSend, adjustHeight]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
        e.preventDefault();
        handleSend();
      }
    },
    [value, handleSend],
  );

  return (
    <div className="w-full">
      <div className="rounded-xl border border-[var(--fintheon-accent)]/15 bg-[#0a0907] transition-all focus-within:border-[var(--fintheon-accent)]/40 focus-within:ring-1 focus-within:ring-[var(--fintheon-accent)]/15">
        {/* Textarea */}
        <div className="px-3 pt-3">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full resize-none bg-transparent text-sm text-[var(--fintheon-text)] placeholder:text-zinc-600 outline-none"
            rows={1}
          />
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-3 pb-2 pt-1">
          {/* Left: agent switcher */}
          <div className="relative" ref={dropdownRef}>
            {agents.length > 1 ? (
              <>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8 transition-colors"
                >
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={selectedAgent?.id}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-1.5"
                    >
                      {selectedAgent?.icon}
                      {selectedAgent?.label}
                    </motion.span>
                  </AnimatePresence>
                  <ChevronDown size={12} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown */}
                <AnimatePresence>
                  {showDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.96 }}
                      transition={{ duration: 0.12 }}
                      className="absolute bottom-full left-0 mb-1 min-w-[180px] rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#0f0e0a] shadow-xl z-50"
                    >
                      {agents.map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() => {
                            onAgentChange?.(agent.id);
                            setShowDropdown(false);
                          }}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-[var(--fintheon-accent)]/8 hover:text-[var(--fintheon-accent)] transition-colors first:rounded-t-lg last:rounded-b-lg"
                        >
                          <span className="flex items-center gap-1.5">
                            {agent.icon}
                            {agent.label}
                          </span>
                          {agent.id === activeAgentId && <Check size={12} className="text-[var(--fintheon-accent)]" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : selectedAgent ? (
              <span className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-500">
                {selectedAgent.icon}
                {selectedAgent.label}
              </span>
            ) : null}
          </div>

          {/* Right: send */}
          <button
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            className="flex items-center justify-center rounded-full bg-[var(--fintheon-accent)] text-black transition-all hover:bg-[#C5A030] disabled:opacity-30 shadow-[0_4px_12px_rgba(199,159,74,0.2)]"
            style={{ width: '30px', height: '30px' }}
          >
            <ArrowUp size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};
