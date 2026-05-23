// [codex 2026-05-23] Composer intelligence selector replacing the binary deep-thinking toggle.
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  REASONING_LEVELS,
  type ReasoningLevel,
  normalizeReasoningLevel,
} from "./reasoning";

interface ReasoningLevelSelectorProps {
  value: ReasoningLevel;
  onChange: (value: ReasoningLevel) => void;
  compact?: boolean;
}

export function ReasoningLevelSelector({
  value,
  onChange,
  compact,
}: ReasoningLevelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = REASONING_LEVELS.find((l) => l.id === value);

  const close = () => {
    setIsClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
    }, 140);
  };

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-zinc-500 transition-colors hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
        title={`Reasoning: ${active?.label ?? "Standard"}`}
      >
        {!compact && (
          <span className="text-[10px] font-medium">
            {active?.label ?? "Standard"}
          </span>
        )}
        <ChevronDown size={10} className="opacity-50" />
      </button>

      {open && (
        <div
          className={`fintheon-popover-motion absolute bottom-full left-0 z-50 mb-2 w-[230px] overflow-hidden rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#0a0905] ${
            isClosing ? "is-closing" : ""
          }`}
          style={{ boxShadow: "none" }}
        >
          <div className="border-b border-[var(--fintheon-accent)]/10 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fintheon-accent)]">
              reasoning
            </p>
          </div>
          {REASONING_LEVELS.map((level) => {
            const isActive = normalizeReasoningLevel(value) === level.id;
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => {
                  onChange(level.id);
                  close();
                }}
                className="flex w-full items-start px-3 py-2 text-left transition-colors hover:bg-[var(--fintheon-accent)]/6"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-[var(--fintheon-text)]/80">
                      {level.label}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[9px] text-[var(--fintheon-text)]/30">
                      {level.budget}
                      {isActive ? (
                        <Check size={10} className="text-[var(--fintheon-accent)]" />
                      ) : null}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-[var(--fintheon-text)]/35">
                    {level.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
