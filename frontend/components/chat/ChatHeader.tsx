// [claude-code 2026-03-07] Removed GitHub connect button (→ Settings TODO) + persona selector
import { CalendarCheck } from 'lucide-react';

interface ChatHeaderProps {
  onRunMDB: () => void;
  onNewChat: () => void;
  onToggleCheckpoints: () => void;
  showCheckpoints: boolean;
  isLoading: boolean;
}

export function ChatHeader({ onRunMDB, onNewChat, onToggleCheckpoints, isLoading }: ChatHeaderProps) {
  // TODO: GitHub Models connect/disconnect → Settings panel

  return (
    <div className="bg-transparent">
      <div className="h-14 flex items-center justify-end px-6 mt-1">
        <div className="flex items-center gap-3">
          <button
            onClick={onRunMDB}
            disabled={isLoading}
            className="px-3 py-1.5 disabled:opacity-50 rounded text-[13px] text-zinc-400 transition-all whitespace-nowrap pulse-accent-hover"
          >
            Dawn Dispatch
          </button>
          <button
            onClick={onNewChat}
            className="px-3 py-1.5 hover:bg-white/5 rounded text-xs font-medium text-zinc-400 whitespace-nowrap transition-colors"
          >
            New Chat
          </button>
          <button
            onClick={onToggleCheckpoints}
            className="px-3 py-1.5 hover:bg-white/5 rounded text-xs font-medium text-zinc-400 whitespace-nowrap transition-colors flex items-center gap-1.5"
            title="Checkpoints (bookmarks) replace thread history"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            Checkpoints
          </button>
        </div>
      </div>
    </div>
  );
}

