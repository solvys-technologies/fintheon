// [claude-code 2026-04-03] Extracted from MainLayout.tsx — sliding chat panel
import React, { useState } from 'react';
import { X, MessageSquare, Users, Cpu, Clock } from 'lucide-react';
import { ChatSidebar } from '../chat/ChatSidebar';
import { SessionsPanel } from '../chat/SessionsPanel';

type NavTab = 'feed' | 'analysis' | 'riskflow' | 'dashboard' | 'econ' | 'narrative' | 'apparatus' | 'performance' | 'proposals' | 'settings';

interface ChatPanelProps {
  showChat: boolean;
  onClose: () => void;
  navigateTab: (tab: NavTab) => void;
}

export function ChatPanel({ showChat, onClose, navigateTab }: ChatPanelProps) {
  const [showSessionsPopup, setShowSessionsPopup] = useState(false);

  return (
    <div
      className={`absolute right-0 top-0 bottom-0 w-[360px] z-40 flex flex-col bg-[var(--fintheon-surface)] border-l border-[var(--fintheon-accent)]/20 shadow-2xl transition-transform duration-300 ease-in-out ${showChat ? 'translate-x-0' : 'translate-x-full'}`}
      style={{ pointerEvents: showChat ? 'auto' : 'none' }}
    >
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
        {/* Left icons -- match main Consilium functions + session history */}
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
          {/* Session history popup */}
          <div className="relative">
            <button
              onClick={() => setShowSessionsPopup((v: boolean) => !v)}
              className={`p-1.5 rounded-md transition-colors ${showSessionsPopup ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10' : 'text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8'}`}
              title="Sessions"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
            {showSessionsPopup && (
              <div
                className="absolute top-full right-0 mt-1 z-50 w-[240px] max-h-[280px] rounded-lg border overflow-hidden backdrop-blur-xl"
                style={{
                  borderColor: 'color-mix(in srgb, var(--fintheon-accent) 25%, transparent)',
                  backgroundColor: 'color-mix(in srgb, var(--fintheon-bg) 95%, var(--fintheon-accent) 5%)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                }}
              >
                <SessionsPanel
                  onSelectSession={(id) => { setShowSessionsPopup(false); }}
                  onNewSession={() => { setShowSessionsPopup(false); }}
                />
              </div>
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
