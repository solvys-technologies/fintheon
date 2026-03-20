import { useState, useEffect } from 'react';
import { MessageSquare, Clock, RefreshCw, Diamond } from 'lucide-react';
import { useBackend } from '../../lib/backend';
import type { ConversationListItem } from '../../lib/services';

interface ThreadHistoryItem extends ConversationListItem {
  pnl?: number;
  erStatus?: 'Stable' | 'Tilt' | 'Neutral';
}

export function ThreadHistory() {
  const backend = useBackend();
  const [threads, setThreads] = useState<ThreadHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const fetchConversations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const conversations = await backend.ai.listConversations({ limit: 10 });
      
      // Enrich with mock P&L and ER status for now
      // TODO: Fetch real P&L and ER from backend
      const enriched: ThreadHistoryItem[] = conversations.map((conv, idx) => ({
        ...conv,
        // Mock data for display - replace with real data later
        pnl: Math.random() > 0.5 ? Math.random() * 500 - 100 : undefined,
        erStatus: ['Stable', 'Tilt', 'Neutral'][Math.floor(Math.random() * 3)] as 'Stable' | 'Tilt' | 'Neutral',
      }));
      
      setThreads(enriched);
    } catch (err) {
      console.error('[ThreadHistory] Failed to fetch conversations:', err);
      setError('Failed to load threads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    // Refresh every 60 seconds
    const interval = setInterval(fetchConversations, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const formatFullDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && threads.length === 0) {
    return (
      <div className="bg-[#050500] border border-[#D4AF37]/20 rounded-lg p-4 min-h-[280px]">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-[#D4AF37]" />
          <h3 className="text-sm font-semibold text-[#D4AF37]">Thread History</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-4 h-4 text-[#D4AF37] animate-spin" />
          <span className="ml-2 text-xs text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#050500] border border-[#D4AF37]/20 rounded-lg p-4 min-h-[280px]">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-[#D4AF37]" />
          <h3 className="text-sm font-semibold text-[#D4AF37]">Thread History</h3>
        </div>
        <p className="text-xs text-red-400 text-center py-4">{error}</p>
        <button 
          onClick={fetchConversations}
          className="w-full text-xs text-[#D4AF37] hover:text-[#D4AF37]/80 py-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="bg-[#050500] border border-[#D4AF37]/20 rounded-lg p-4 min-h-[280px]">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-[#D4AF37]" />
          <h3 className="text-sm font-semibold text-[#D4AF37]">Thread History</h3>
        </div>
        <p className="text-xs text-gray-500 text-center py-8">No conversations yet</p>
        <p className="text-[10px] text-gray-600 text-center">Start a chat to see threads here</p>
      </div>
    );
  }

  return (
    <div className="bg-[#050500] border border-[#D4AF37]/20 rounded-lg p-4 min-h-[280px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#D4AF37]" />
          <h3 className="text-sm font-semibold text-[#D4AF37]">Thread History</h3>
        </div>
        <button 
          onClick={fetchConversations}
          disabled={loading}
          className="p-1 hover:bg-[#D4AF37]/10 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3 h-3 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {/* Scrollable container for 3-4 cards */}
      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#D4AF37]/20 scrollbar-track-transparent">
        {threads.map(thread => (
          <button
            key={thread.id}
            onClick={() => setActiveThreadId(thread.id)}
            className={`w-full text-left p-3 rounded-lg bg-black/30 border transition-all hover:shadow-md ${
              activeThreadId === thread.id
                ? 'border-[#D4AF37]/50 bg-[#D4AF37]/10'
                : 'border-[#D4AF37]/20 hover:border-[#D4AF37]/30 hover:bg-[#D4AF37]/5'
            }`}
          >
            {/* Top row: Title and Date */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-gray-300 truncate flex-1 leading-tight">
                {thread.title || 'Untitled Conversation'}
              </span>
              <span className="text-[9px] text-gray-500 whitespace-nowrap">
                {formatFullDate(thread.updatedAt)}
              </span>
            </div>
            
            {/* Middle row: P&L and ER indicators */}
            <div className="flex items-center gap-3 mb-1.5">
              {/* P&L indicator with colored dot */}
              {thread.pnl !== undefined && (
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${
                    thread.pnl >= 0 ? 'bg-emerald-400' : 'bg-red-500'
                  }`} />
                  <span className={`text-xs font-semibold ${
                    thread.pnl >= 0 ? 'text-emerald-400' : 'text-red-500'
                  }`}>
                    {thread.pnl >= 0 ? '+' : ''}${thread.pnl.toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* ER indicator with diamond */}
              {thread.erStatus && (
                <div className="flex items-center gap-1">
                  <Diamond className={`w-3 h-3 ${
                    thread.erStatus === 'Stable' ? 'text-emerald-400 fill-emerald-400' :
                    thread.erStatus === 'Tilt' ? 'text-red-500 fill-red-500' :
                    'text-gray-400'
                  }`} />
                  <span className={`text-[10px] font-medium ${
                    thread.erStatus === 'Stable' ? 'text-emerald-400' :
                    thread.erStatus === 'Tilt' ? 'text-red-500' :
                    'text-gray-400'
                  }`}>
                    {thread.erStatus}
                  </span>
                </div>
              )}
            </div>
            
            {/* Bottom row: Time ago and message count */}
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatDate(thread.updatedAt)}</span>
              </div>
              <span>{thread.messageCount} message{thread.messageCount !== 1 ? 's' : ''}</span>
            </div>
          </button>
        ))}
      </div>
      
      {threads.length >= 10 && (
        <p className="text-[10px] text-gray-500 text-center pt-2 border-t border-[#D4AF37]/10 mt-2">
          View chat history for more
        </p>
      )}
    </div>
  );
}
