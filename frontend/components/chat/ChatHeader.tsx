// [claude-code 2026-04-04] T4: History dropdown — Clock button toggles dropdown instead of modal
import { useState } from "react";
import { Scroll, Plus, Clock } from "lucide-react";
import { SessionsDropdown } from "./SessionsDropdown";

interface ChatHeaderProps {
  onRunMDB: () => void;
  onNewChat: () => void;
  onSelectSession: (conversationId: string) => void;
  onNewSession: () => void;
  currentConversationId?: string;
  isLoading: boolean;
}

export function ChatHeader({
  onRunMDB,
  onNewChat,
  onSelectSession,
  onNewSession,
  currentConversationId,
  isLoading,
}: ChatHeaderProps) {
  const [showHistory, setShowHistory] = useState(false);

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
          <div className="relative">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="p-2 rounded-lg text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
              title="Sessions"
            >
              <Clock className="w-4 h-4" />
            </button>
            {showHistory && (
              <SessionsDropdown
                onClose={() => setShowHistory(false)}
                onSelectSession={(id) => {
                  onSelectSession(id);
                  setShowHistory(false);
                }}
                onNewSession={() => {
                  onNewSession();
                  setShowHistory(false);
                }}
                currentConversationId={currentConversationId}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
