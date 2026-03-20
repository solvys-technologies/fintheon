import { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, Loader2 } from 'lucide-react';
import { ToolOutputBubble, type ToolOutputData } from './ToolOutputBubble';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ToolOutputsPeekProps {
  tools: ToolOutputData[];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ToolOutputsPeek({ tools }: ToolOutputsPeekProps) {
  const [expanded, setExpanded] = useState(false);

  if (tools.length === 0) return null;

  const running = tools.filter((t) => t.status === 'running').length;
  const done = tools.filter((t) => t.status === 'done').length;

  return (
    <div className="mb-3">
      {/* Header pill */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#0b0b08] hover:bg-[var(--fintheon-accent)]/5 transition-colors"
        style={{ padding: '5px 10px' }}
      >
        <Wrench size={12} className="text-gray-500" />
        <span className="text-[11px] font-medium text-gray-400">
          {running > 0 ? `${running} running` : `${done} tools`}
        </span>
        {running > 0 && <Loader2 size={11} className="text-[var(--fintheon-accent)] animate-spin" />}
        {expanded ? <ChevronDown size={12} className="text-gray-500 ml-1" /> : <ChevronRight size={12} className="text-gray-500 ml-1" />}
      </button>

      {/* Expanded list */}
      {expanded && (
        <div className="mt-2 space-y-2">
          {tools.map((tool) => (
            <ToolOutputBubble key={tool.id} tool={tool} />
          ))}
        </div>
      )}
    </div>
  );
}
