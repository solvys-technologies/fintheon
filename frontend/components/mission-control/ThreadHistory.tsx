import { MessageSquare, Clock } from 'lucide-react';
import { useThread } from '../../contexts/ThreadContext';

export function ThreadHistory() {
  const { threads, activeThreadId, setActiveThreadId } = useThread();

  const formatDate = (date: Date) => {
    const d = new Date(date);
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

  if (threads.length === 0) {
    return (
      <div className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-[var(--fintheon-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--fintheon-accent)]">Thread History</h3>
        </div>
        <p className="text-xs text-gray-500 text-center py-4">No threads yet</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-[var(--fintheon-accent)]" />
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)]">Thread History</h3>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {threads.slice(0, 5).map(thread => (
          <button
            key={thread.id}
            onClick={() => setActiveThreadId(thread.id)}
            className={`w-full text-left p-2 rounded bg-black/30 border transition-colors ${
              activeThreadId === thread.id
                ? 'border-[var(--fintheon-accent)]/50 bg-[var(--fintheon-accent)]/10'
                : 'border-[var(--fintheon-accent)]/20 hover:border-[var(--fintheon-accent)]/30 hover:bg-[var(--fintheon-accent)]/5'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-xs font-medium text-gray-300 truncate flex-1">
                {thread.title || 'Untitled Thread'}
              </span>
              {thread.pnl !== undefined && (
                <span
                  className={`text-xs font-semibold whitespace-nowrap ${
                    thread.pnl >= 0 ? 'text-emerald-400' : 'text-red-500'
                  }`}
                >
                  {thread.pnl >= 0 ? '+' : ''}${thread.pnl.toFixed(2)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatDate(thread.createdAt)}</span>
              </div>
              <span>{thread.messages.length} message{thread.messages.length !== 1 ? 's' : ''}</span>
              {thread.resonanceState && (
                <span
                  className={`uppercase ${
                    thread.resonanceState === 'Tilt'
                      ? 'text-red-500'
                      : thread.resonanceState === 'Stable'
                      ? 'text-emerald-400'
                      : 'text-gray-400'
                  }`}
                >
                  {thread.resonanceState}
                </span>
              )}
            </div>
          </button>
        ))}
        {threads.length > 5 && (
          <p className="text-[10px] text-gray-500 text-center pt-2">
            +{threads.length - 5} more thread{threads.length - 5 !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
