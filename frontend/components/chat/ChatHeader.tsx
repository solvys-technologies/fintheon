// [claude-code 2026-04-04] T4: History dropdown — Clock button toggles dropdown instead of modal
// [claude-code 2026-04-17] Relay button — copies pickup code so conversation can be relayed to another device
import { useState } from "react";
import { Scroll, Plus, Clock, Radio, Check } from "lucide-react";
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
  const [relayCopied, setRelayCopied] = useState(false);

  const handleRelay = async () => {
    if (!currentConversationId) return;
    const pickupCode = currentConversationId;
    try {
      await navigator.clipboard.writeText(pickupCode);
      setRelayCopied(true);
      setTimeout(() => setRelayCopied(false), 1500);
    } catch {
      // Clipboard unavailable — still flash state for feedback
      setRelayCopied(true);
      setTimeout(() => setRelayCopied(false), 1500);
    }
  };

  return (
    <div className="bg-transparent">
      <div className="h-12 flex items-center justify-end px-4 mt-0.5">
        <div className="flex items-center gap-1">
          <button
            onClick={handleRelay}
            disabled={!currentConversationId}
            className={`p-2 rounded-lg transition-colors ${
              !currentConversationId
                ? "text-zinc-700 cursor-not-allowed"
                : relayCopied
                  ? "text-emerald-400 bg-emerald-500/10"
                  : "text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10"
            }`}
            title={
              !currentConversationId
                ? "Relay — start a conversation first"
                : relayCopied
                  ? "Pickup code copied"
                  : "Relay — copy pickup code for another device"
            }
          >
            {relayCopied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Radio className="w-4 h-4" />
            )}
          </button>
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
