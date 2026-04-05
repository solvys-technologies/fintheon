// [claude-code 2026-04-05] Fix sidebar icons to match main Consilium toolbar (Scroll, Plus, Clock)
// [claude-code 2026-04-03] Extracted from MainLayout.tsx — sliding chat panel
import React, { useState } from 'react';
import { X, Scroll, Plus, Clock } from 'lucide-react';
import { ChatSidebar } from '../chat/ChatSidebar';
import { SessionsModal } from '../chat/SessionsModal';

interface ChatPanelProps {
  showChat: boolean;
  onClose: () => void;
  navigateTab: (tab: string) => void;
}

export function ChatPanel({ showChat, onClose }: ChatPanelProps) {
  const [showSessionsDropdown, setShowSessionsDropdown] = useState(false);

  return (
    <div
      className={`absolute right-0 top-0 bottom-0 w-[360px] z-40 flex flex-col bg-[var(--fintheon-surface)] border-l border-[var(--fintheon-accent)]/20 shadow-2xl transition-all duration-300 ease-in-out ${showChat ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none invisible'}`}
    >
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
        {/* Left icons — match main Consilium chat toolbar: Report, New, History */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => window.dispatchEvent(new Event('fintheon:chat-run-report'))}
            className="p-1.5 rounded-md text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8 transition-colors"
            title="Run Report"
          >
            <Scroll className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => window.dispatchEvent(new Event('fintheon:chat-new'))}
            className="p-1.5 rounded-md text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8 transition-colors"
            title="New Chat"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowSessionsDropdown(prev => !prev)}
              className="p-1.5 rounded-md text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8 transition-colors"
              title="History"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
            <SessionsModal
              isOpen={showSessionsDropdown}
              onClose={() => setShowSessionsDropdown(false)}
              onSelectSession={(id) => {
                window.dispatchEvent(new CustomEvent('fintheon:chat-load-session', { detail: { id } }));
                setShowSessionsDropdown(false);
              }}
              onNewSession={() => {
                window.dispatchEvent(new Event('fintheon:chat-new'));
                setShowSessionsDropdown(false);
              }}
            />
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
