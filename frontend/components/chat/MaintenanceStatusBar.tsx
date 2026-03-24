// [claude-code 2026-03-06] Kanban-border maintenance status bar for footer toolbar
import { useEffect } from 'react';
import { Loader2, Check, X } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type MaintenanceStatus = 'idle' | 'updating' | 'applied' | 'changelog' | 'done';

interface MaintenanceStatusBarProps {
  status: MaintenanceStatus;
  message?: string;
  onDismiss: () => void;
}

export function MaintenanceStatusBar({ status, message, onDismiss }: MaintenanceStatusBarProps) {
  // Auto-dismiss after 3s when done
  useEffect(() => {
    if (status === 'done') {
      const timer = setTimeout(onDismiss, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, onDismiss]);

  if (status === 'idle') return null;

  const statusConfig: Record<Exclude<MaintenanceStatus, 'idle'>, { icon: typeof Loader2 | typeof Check; iconColor: string; spin: boolean; label: string }> = {
    updating: { icon: Loader2, iconColor: 'var(--fintheon-accent)', spin: true, label: message || 'Updating...' },
    applied: { icon: Check, iconColor: '#22C55E', spin: false, label: 'Changes applied' },
    changelog: { icon: Check, iconColor: '#22C55E', spin: false, label: 'Changelog updated' },
    done: { icon: Check, iconColor: '#22C55E', spin: false, label: 'Maintenance complete' },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className="border-2 border-[var(--fintheon-accent)] rounded-lg px-4 py-2 bg-[var(--fintheon-surface)] flex items-center gap-3">
      <StatusIcon
        size={16}
        className={config.spin ? 'animate-spin' : ''}
        style={{ color: config.iconColor, flexShrink: 0 }}
      />
      <span className="text-sm text-zinc-300 font-medium flex-1">
        {config.label}
      </span>
      <button
        onClick={onDismiss}
        className="text-zinc-500 hover:text-white transition-colors flex-shrink-0"
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
