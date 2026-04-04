// [claude-code 2026-04-04] T4: History dropdown replaces full-screen SessionsModal
import React, { useState } from 'react';
import { X, MessageSquare, Users, Cpu, Clock } from 'lucide-react';
import { ChatSidebar } from '../chat/ChatSidebar';
import { SessionsDropdown } from '../chat/SessionsDropdown';

type NavTab = 'feed' | 'analysis' | 'riskflow' | 'dashboard' | 'econ' | 'narrative' | 'apparatus' | 'performance' | 'proposals' | 'settings';

interface ChatPanelProps {
  showChat: boolean;
  onClose: () => void;
  navigateTab: (tab: NavTab) => void;
}

export function ChatPanel({ showChat, onClose, navigateTab }: ChatPanelProps) {
  const [showSessionsDropdown, setShowSessionsDropdown] = useState(false);

  return (
    <div
      className={`absolute right-0 top-0 bottom-0 w-[360px] z-40 flex flex-col bg-[var(--fintheon-surface)] border-l border-[var(--fintheon-accent)]/20 shadow-2xl transition-transform duration-300 ease-in-out ${showChat ? 'translate-x-0' : 'translate-x-full'}`}
      style={{ pointerEvents: showChat ? 'auto' : 'none' }}
    >
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
        {/* Left icons — match main Consilium functions + session history */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => { onClose(); navigateTab('analysis'); }}
            className="p-1.5 rounded-md text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8 transition-colors"
            title="Ask Harp (full)"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { onClose(); navigateTab('analysis'); }}
            className="p-1.5 rounded-md text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8 transition-colors"
            title="Boardroom"
          >
            <Users className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { onClose(); navigateTab('analysis'); }}
            className="p-1.5 rounded-md text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8 transition-colors"
            title="Apparatus"
          >
            <Cpu className="w-3.5 h-3.5" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowSessionsDropdown(v => !v)}
              className="p-1.5 rounded-md text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8 transition-colors"
              title="Sessions"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
            {showSessionsDropdown && (
              <SessionsDropdown
                onClose={() => setShowSessionsDropdown(false)}
                onSelectSession={() => setShowSessionsDropdown(false)}
                onNewSession={() => setShowSessionsDropdown(false)}
              />
            )}
          </div>
        </div>
        {/* Close */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8 transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatSidebar />
      </div>
    </div>
  );
}
