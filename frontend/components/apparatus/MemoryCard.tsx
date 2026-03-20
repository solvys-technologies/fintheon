// [claude-code 2026-03-20] Memory card — satellite fact card orbiting agent nodes
import { useState } from 'react';
import { Twitter, NotebookText, BarChart3, TrendingUp, MessageSquare, Pencil, History } from 'lucide-react';
import type { AgentMemory, MemorySource } from './types';

const SOURCE_ICONS: Record<MemorySource, typeof Twitter> = {
  twitter: Twitter,
  notion: NotebookText,
  mirofish: BarChart3,
  trade: TrendingUp,
  boardroom: MessageSquare,
  manual: Pencil,
};

const SOURCE_LABELS: Record<MemorySource, string> = {
  twitter: 'Twitter',
  notion: 'Notion',
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
    <div className="w-full h-full bg-[#0a0a00]/95 border border-[#c79f4a]/20 rounded-md px-2 py-1.5 flex flex-col gap-0.5 text-[#f0ead6] overflow-hidden">
      {/* Top row: source icon + version + timestamp */}
      <div className="flex items-center justify-between gap-1 shrink-0">
        <div className="flex items-center gap-1">
          <SourceIcon size={8} className="text-[#c79f4a]/60 shrink-0" />
          <span className="text-[7px] text-[#c79f4a]/50 uppercase tracking-wider">{SOURCE_LABELS[memory.source]}</span>
        </div>
        <div className="flex items-center gap-1">
          {memory.history && memory.history.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowHistory(!showHistory); }}
              className="text-[7px] text-[#c79f4a]/40 hover:text-[#c79f4a] flex items-center gap-0.5"
              title="View version history"
            >
              <History size={7} />
              v{memory.version}
            </button>
          )}
          {(!memory.history || memory.history.length === 0) && (
            <span className="text-[7px] text-[#c79f4a]/30">v{memory.version}</span>
          )}
        </div>
      </div>

      {/* Fact text */}
      <div className="text-[8px] leading-tight line-clamp-2 flex-1 min-h-0">
        {showHistory && memory.history ? memory.history[0]?.fact : memory.fact}
      </div>

      {/* Bottom row: confidence bar + elapsed */}
      <div className="flex items-center justify-between gap-1 shrink-0">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <div className="w-12 h-1 rounded-full bg-[#c79f4a]/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#c79f4a]"
              style={{ width: `${memory.confidence * 100}%`, opacity: 0.6 + memory.confidence * 0.4 }}
            />
          </div>
          <span className="text-[6px] text-[#c79f4a]/40">{Math.round(memory.confidence * 100)}%</span>
        </div>
        <span className="text-[6px] text-[#f0ead6]/25 shrink-0">{elapsed}</span>
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
