// [claude-code 2026-03-20] S3:T10d — Notification Center dropdown: queued notifications, timestamps, clear all
import { useEffect, useRef } from 'react';
import { X, Bell, BellOff, Trash2, Diff, Newspaper, AlertTriangle, Server, ShieldAlert } from 'lucide-react';
import { useDND, type QueuedNotification } from '../contexts/DNDContext';

function notificationIcon(type: QueuedNotification['type']) {
  switch (type) {
    case 'iv': return <Diff className="w-3.5 h-3.5" style={{ color: 'var(--fintheon-accent)' }} />;
    case 'news': return <Newspaper className="w-3.5 h-3.5" style={{ color: 'var(--fintheon-accent)' }} />;
    case 'tilt': return <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#f97316' }} />;
    case 'trade': return <ShieldAlert className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />;
    case 'warning': return <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />;
    case 'system': return <Server className="w-3.5 h-3.5" style={{ color: 'var(--fintheon-muted)' }} />;
  }
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationCenter({ open, onClose }: NotificationCenterProps) {
  const { queue, dismissQueued, clearQueue, dndActive, toggleManualDnd } = useDND();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid closing immediately on the click that opened it
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute left-12 bottom-8 z-50 animate-fade-in-tab"
      style={{
        width: '340px',
        maxHeight: '420px',
        backgroundColor: 'var(--fintheon-surface)',
        border: '1px solid var(--fintheon-accent)',
        borderRadius: '10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: 'var(--fintheon-accent)', opacity: 0.3 }}>
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5" style={{ color: 'var(--fintheon-accent)' }} />
          <span className="text-[12px] font-semibold" style={{ color: 'var(--fintheon-text)' }}>
            Notifications
          </span>
          {queue.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500/30 text-red-400 text-[10px] font-bold">
              {queue.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* DND toggle in header */}
          <button
            onClick={toggleManualDnd}
            className="p-1 rounded transition-colors"
            style={{ color: dndActive ? 'var(--fintheon-accent)' : 'var(--fintheon-muted)' }}
            title={dndActive ? 'Disable Do Not Disturb' : 'Enable Do Not Disturb'}
          >
            {dndActive ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors hover:bg-white/5"
            style={{ color: 'var(--fintheon-muted)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Bell className="w-6 h-6" style={{ color: 'var(--fintheon-muted)', opacity: 0.4 }} />
            <span className="text-[11px]" style={{ color: 'var(--fintheon-muted)' }}>
              No queued notifications
            </span>
          </div>
        ) : (
          <div className="py-1">
            {queue.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-2.5 px-3 py-2 hover:bg-white/[0.03] transition-colors group"
              >
                <div className="mt-0.5 shrink-0">
                  {notificationIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--fintheon-text)' }}>
                    {n.title}
                  </div>
                  <div className="text-[10px] mt-0.5 line-clamp-2" style={{ color: 'var(--fintheon-muted)' }}>
                    {n.message}
                  </div>
                  <div className="text-[9px] mt-1" style={{ color: 'rgba(107,114,128,0.5)' }}>
                    {timeAgo(n.timestamp)}
                  </div>
                </div>
                <button
                  onClick={() => dismissQueued(n.id)}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                  style={{ color: 'var(--fintheon-muted)' }}
                  title="Dismiss"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer — Clear All */}
      {queue.length > 0 && (
        <div className="border-t px-3 py-2 flex justify-center" style={{ borderColor: 'rgba(var(--fintheon-accent-rgb, 199,159,74), 0.15)' }}>
          <button
            onClick={clearQueue}
            className="flex items-center gap-1.5 text-[10px] rounded px-2 py-1 transition-colors hover:bg-white/5"
            style={{ color: 'var(--fintheon-muted)' }}
          >
            <Trash2 className="w-3 h-3" />
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
