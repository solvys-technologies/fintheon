// [claude-code 2026-03-22] Source of Truth fusion — full 14 commandments sidebar with expand/collapse
import { useState } from 'react';
import { Lock, AlertTriangle, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { COMMANDMENTS } from './commandments-data';
import type { Commandment, CommandmentBlockLevel } from './types';

const BLOCK_ICON: Record<CommandmentBlockLevel, { icon: typeof Lock; color: string; label: string }> = {
  hard: { icon: Lock, color: 'text-red-400', label: 'HARD' },
  soft: { icon: AlertTriangle, color: 'text-[var(--fintheon-accent)]/60', label: 'SOFT' },
  guidance: { icon: Info, color: 'text-[var(--fintheon-text)]/30', label: 'GUIDE' },
};

function CommandmentItem({ cmd }: { cmd: Commandment }) {
  const [expanded, setExpanded] = useState(false);
  const block = BLOCK_ICON[cmd.blockLevel];
  const BlockIcon = block.icon;

  return (
    <div
      className={`rounded transition-colors ${
        expanded ? 'bg-[var(--fintheon-accent)]/5' : ''
      }`}
    >
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-start gap-1.5 text-left py-1 px-1 rounded hover:bg-[var(--fintheon-accent)]/5"
      >
        <span className="text-[9px] font-bold text-[var(--fintheon-accent)]/50 shrink-0 w-5 text-right font-mono mt-px">
          {cmd.number}.
        </span>
        <BlockIcon size={8} className={`${block.color} shrink-0 mt-[3px]`} />
        <span className="text-[9px] text-[var(--fintheon-text)]/70 leading-relaxed font-mono flex-1">
          {cmd.text}
        </span>
        {expanded
          ? <ChevronDown size={8} className="text-[var(--fintheon-accent)]/30 shrink-0 mt-[3px]" />
          : <ChevronRight size={8} className="text-[var(--fintheon-accent)]/20 shrink-0 mt-[3px]" />
        }
      </button>

      {expanded && (
        <div className="pl-8 pr-2 pb-2 space-y-1.5 animate-fade-in-tab">
          <p className="text-[8px] text-[var(--fintheon-text)]/50 leading-relaxed">
            {cmd.fullText}
          </p>

          {cmd.mentorSource && (
            <div className="text-[7px] text-[var(--fintheon-accent)]/40 font-mono italic">
              -- {cmd.mentorSource}
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            <span className={`text-[7px] font-mono px-1 py-0.5 rounded border ${
              cmd.blockLevel === 'hard'
                ? 'border-red-500/30 text-red-400 bg-red-500/5'
                : cmd.blockLevel === 'soft'
                  ? 'border-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]/50'
                  : 'border-[var(--fintheon-text)]/10 text-[var(--fintheon-text)]/30'
            }`}>
              {block.label} BLOCK
            </span>
            {cmd.relatedCommandments.map(n => (
              <span key={n} className="text-[7px] font-mono px-1 py-0.5 rounded border border-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]/30">
                C{n}
              </span>
            ))}
          </div>

          {Object.entries(cmd.agentUsage).length > 0 && (
            <div className="space-y-0.5 pt-0.5">
              {Object.entries(cmd.agentUsage).map(([agent, usage]) => (
                <div key={agent} className="flex gap-1">
                  <span className="text-[7px] text-[var(--fintheon-accent)]/40 font-mono shrink-0">{agent}:</span>
                  <span className="text-[7px] text-[var(--fintheon-text)]/35">{usage}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CommandmentsSidebar() {
  const hardCount = COMMANDMENTS.filter(c => c.blockLevel === 'hard').length;

  return (
    <div className="w-[220px] shrink-0 border-r border-[var(--fintheon-accent)]/10 flex flex-col overflow-y-auto">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Lock size={10} className="text-[var(--fintheon-accent)]/60" />
            <span className="text-[10px] font-semibold text-[var(--fintheon-accent)] tracking-[0.15em] uppercase">
              Rules of Engagement
            </span>
          </div>
          <span className="text-[7px] font-mono text-red-400/50">
            {hardCount} hard
          </span>
        </div>
        <div className="border border-[var(--fintheon-accent)]/20 rounded-md bg-[var(--fintheon-surface)] p-2 space-y-0.5">
          {COMMANDMENTS.map(cmd => (
            <CommandmentItem key={cmd.number} cmd={cmd} />
          ))}
        </div>
      </div>
    </div>
  );
}
