// [claude-code 2026-04-18] Header hit targets widened to 44×44 (iOS HIG / Electron touch
//   guideline). Previous p-2 with 16px icons was a 32×32 target — uncomfortable on touch-mode
//   MacBooks and trackpads. Icon size unchanged; only the tap surface grew.
// [claude-code 2026-04-18] S21-T1: relay button moved to FintheonComposer action cluster.
// Clipboard-copy pickup-code flow deprecated in favor of active dispatch via /api/relay/dispatch.
// [claude-code 2026-04-04] T4: History dropdown — Clock button toggles dropdown instead of modal
import { useState } from "react";
import { Scroll, Plus, Clock } from "@/components/shared/iso-icons";
import { SessionsDropdown } from "./SessionsDropdown";

const HEADER_BUTTON_CLASS =
  "w-11 h-11 flex items-center justify-center rounded-lg text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors disabled:opacity-40";

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
      <div className="h-14 flex items-center justify-end px-4 mt-0.5">
        <div className="flex items-center gap-1">
          <button
            onClick={onRunMDB}
            disabled={isLoading}
            className={HEADER_BUTTON_CLASS}
            title="Dawn Dispatch"
          >
            <Scroll className="w-4 h-4" />
          </button>
          <button
            onClick={onNewChat}
            className={HEADER_BUTTON_CLASS}
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className={HEADER_BUTTON_CLASS}
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
