// [claude-code 2026-04-03] Extracted from MainLayout.tsx — sliding chat panel
// [claude-code 2026-04-04] Fix sidebar icons: each navigates to correct Consilium sub-tab; sessions dropdown replaces modal
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, MessageSquare, Users, Cpu, Clock, Loader2, Trash2 } from 'lucide-react';
import { ChatSidebar } from '../chat/ChatSidebar';
import { useConsiliumNav } from '../../lib/consilium-nav-store';
import { API_BASE_URL } from '../chat/constants';

type NavTab = 'feed' | 'analysis' | 'riskflow' | 'dashboard' | 'econ' | 'narrative' | 'apparatus' | 'performance' | 'proposals' | 'settings';

interface ChatPanelProps {
  showChat: boolean;
  onClose: () => void;
  navigateTab: (tab: NavTab) => void;
}

interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
  model?: string;
  isArchived: boolean;
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function SessionsDropdown({ onClose }: { onClose: () => void }) {
  const [sessions, setSessions] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/ai/conversations`)
      .then(r => r.json())
      .then(data => setSessions((data.conversations ?? []).slice(0, 8)))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${API_BASE_URL}/api/ai/conversations/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch { /* ignore */ }
  }, []);

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 mt-1 w-[250px] max-h-[300px] overflow-y-auto rounded-lg border z-50"
      style={{
        backgroundColor: '#0a0a08',
        borderColor: 'color-mix(in srgb, #c79f4a 20%, transparent)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        scrollbarWidth: 'thin',
      }}
    >
      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={14} className="animate-spin" style={{ color: '#c79f4a' }} />
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="px-3 py-4 text-center">
          <p className="text-[11px] text-zinc-600">No sessions yet</p>
        </div>
      )}

      {!loading && sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => {
            // Load session — dispatch to chat sidebar
            onClose();
          }}
          className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors group/item hover:bg-[#c79f4a]/8"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[11px] font-medium truncate" style={{ color: '#f0ead6' }}>
                {session.title}
              </span>
              <span className="text-[9px] text-zinc-600 shrink-0 tabular-nums">
                {formatRelativeDate(session.lastMessageAt)}
              </span>
            </div>
            <span className="text-[9px] text-zinc-600">
              {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={(e) => handleDelete(session.id, e)}
            className="p-0.5 rounded opacity-0 group-hover/item:opacity-100 transition-all text-zinc-600 hover:text-red-400"
            title="Delete"
          >
            <Trash2 size={10} />
          </button>
        </button>
      ))}
    </div>
  );
}

export function ChatPanel({ showChat, onClose, navigateTab }: ChatPanelProps) {
  const [showSessionsDropdown, setShowSessionsDropdown] = useState(false);
  const requestTab = useConsiliumNav((s) => s.requestTab);

  const navigateToConsilium = useCallback((tab: 'chat' | 'boardroom' | 'apparatus') => {
    onClose();
    requestTab(tab);
    navigateTab('analysis');
  }, [onClose, requestTab, navigateTab]);

  return (
    <div
      className={`absolute right-0 top-0 bottom-0 w-[360px] z-40 flex flex-col bg-[var(--fintheon-surface)] border-l border-[var(--fintheon-accent)]/20 shadow-2xl transition-transform duration-300 ease-in-out ${showChat ? 'translate-x-0' : 'translate-x-full'}`}
      style={{ pointerEvents: showChat ? 'auto' : 'none' }}
    >
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
        {/* Left icons — match main Consilium functions + session history */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => navigateToConsilium('chat')}
            className="p-1.5 rounded-md text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8 transition-colors"
            title="Ask Harp (full)"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => navigateToConsilium('boardroom')}
            className="p-1.5 rounded-md text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8 transition-colors"
            title="Boardroom"
          >
            <Users className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => navigateToConsilium('apparatus')}
            className="p-1.5 rounded-md text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8 transition-colors"
            title="Apparatus"
          >
            <Cpu className="w-3.5 h-3.5" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowSessionsDropdown(prev => !prev)}
              className="p-1.5 rounded-md text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8 transition-colors"
              title="Sessions"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
            {showSessionsDropdown && (
              <SessionsDropdown onClose={() => setShowSessionsDropdown(false)} />
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
