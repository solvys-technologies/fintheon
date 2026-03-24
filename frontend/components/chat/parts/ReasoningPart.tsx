// [claude-code 2026-03-06] Collapsible reasoning/thinking part renderer
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface ReasoningPartProps {
  text: string;
  defaultOpen?: boolean;
}

export function ReasoningPartRenderer({ text, defaultOpen = false }: ReasoningPartProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-[var(--fintheon-accent)]/5 rounded-lg p-2 border border-[var(--fintheon-accent)]/15">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-[var(--fintheon-accent)]/70 hover:text-[var(--fintheon-accent)] transition-colors w-full text-left"
      >
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>Thinking...</span>
      </button>
      {isOpen && (
        <div className="border-l-2 border-[var(--fintheon-accent)]/20 pl-3 mt-2 text-xs text-zinc-500 font-mono whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}
