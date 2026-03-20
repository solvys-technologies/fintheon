// [claude-code 2026-03-20] Memory card — intelligence fact card for agent briefing grid
import { useState } from 'react';
import { Twitter, Database, BarChart3, TrendingUp, MessageSquare, Pencil, History } from 'lucide-react';
import type { AgentMemory, MemorySource } from './types';

const SOURCE_ICONS: Record<MemorySource, typeof Twitter> = {
  twitter: Twitter,
  data: Database,
  mirofish: BarChart3,
  trade: TrendingUp,
  boardroom: MessageSquare,
  manual: Pencil,
};

const SOURCE_LABELS: Record<MemorySource, string> = {
  twitter: 'Twitter',
  data: 'Data',
  mirofish: 'MiroFish',
  trade: 'Trade',
  boardroom: 'Boardroom',
  manual: 'Manual',
};

interface MemoryCardProps {
  memory: AgentMemory;
}

export function MemoryCard({ memory }: MemoryCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const SourceIcon = SOURCE_ICONS[memory.source];
  const elapsed = getElapsed(memory.timestamp);

  return (
    <div className="bg-[#0a0a00] border border-[#c79f4a]/15 rounded px-2.5 py-2 flex flex-col gap-1">
      {/* Top row: source icon + version + timestamp */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <SourceIcon size={10} className="text-[#c79f4a]/50 shrink-0" />
          <span className="text-[8px] text-[#c79f4a]/40 uppercase tracking-wider font-mono">{SOURCE_LABELS[memory.source]}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {memory.history && memory.history.length > 0 ? (
            <button
              onClick={(e) => { e.stopPropagation(); setShowHistory(!showHistory); }}
              className="text-[8px] text-[#c79f4a]/40 hover:text-[#c79f4a] flex items-center gap-0.5 font-mono"
              title="View version history"
            >
              <History size={8} />
              v{memory.version}
            </button>
          ) : (
            <span className="text-[8px] text-[#c79f4a]/30 font-mono">v{memory.version}</span>
          )}
          <span className="text-[7px] text-[#f0ead6]/25 font-mono">{elapsed}</span>
        </div>
      </div>

      {/* Fact text */}
      <p className="text-[9px] text-[#f0ead6]/70 leading-relaxed line-clamp-3">
        {showHistory && memory.history ? memory.history[0]?.fact : memory.fact}
      </p>

      {/* Bottom row: confidence bar */}
      <div className="flex items-center gap-1.5">
        <div className="w-14 h-1 rounded-full bg-[#c79f4a]/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#c79f4a]"
            style={{ width: `${memory.confidence * 100}%`, opacity: 0.5 + memory.confidence * 0.5 }}
          />
        </div>
        <span className="text-[7px] text-[#c79f4a]/40 font-mono">{Math.round(memory.confidence * 100)}%</span>
      </div>
    </div>
  );
}

function getElapsed(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
