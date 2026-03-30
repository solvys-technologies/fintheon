// [claude-code 2026-03-29] S9-T5: Renamed checkpoint props to sessions
import { Scroll, Plus, Clock } from 'lucide-react';

interface ChatHeaderProps {
  onRunMDB: () => void;
  onNewChat: () => void;
  onToggleSessions: () => void;
  showSessions: boolean;
  isLoading: boolean;
}

export function ChatHeader({ onRunMDB, onNewChat, onToggleSessions, isLoading }: ChatHeaderProps) {
  return (
    <div className="bg-transparent">
      <div className="h-12 flex items-center justify-end px-4 mt-0.5">
        <div className="flex items-center gap-1">
          <button
            onClick={onRunMDB}
            disabled={isLoading}
            className="p-2 disabled:opacity-40 rounded-lg text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
            title="Dawn Dispatch"
          >
            <Scroll className="w-4 h-4" />
          </button>
          <button
            onClick={onNewChat}
            className="p-2 rounded-lg text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleSessions}
            className="p-2 rounded-lg text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
            title="Sessions"
          >
            <Clock className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

