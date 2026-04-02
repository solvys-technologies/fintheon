import { Apple, Cpu, PlugZap } from 'lucide-react';
import type { PeerRecord } from './types';

interface PeerCardProps {
  peer: PeerRecord;
  isActive?: boolean;
}

function statusClasses(status: PeerRecord['status']): string {
  if (status === 'online') return 'bg-emerald-400';
  if (status === 'away') return 'bg-amber-400';
  return 'bg-zinc-500';
}

function platformLabel(platform: string): string {
  const value = platform.toLowerCase();
  if (value.includes('darwin') || value.includes('mac')) return 'macOS';
  if (value.includes('win')) return 'Windows';
  if (value.includes('linux')) return 'Linux';
  return platform;
}

function formatRelativeTime(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'just now';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function PeerCard({ peer, isActive = false }: PeerCardProps) {
  const cardBorder = isActive
    ? 'border-[var(--fintheon-accent)] shadow-[0_0_0_1px_rgba(199,159,74,0.45)]'
    : 'border-[var(--fintheon-accent)]/20';

  return (
    <article
      className={`w-[280px] min-w-[280px] rounded-xl border bg-[var(--fintheon-surface)] px-3 py-2.5 ${cardBorder}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusClasses(peer.status)}`} />
            <h4 className="truncate text-sm font-semibold text-[var(--fintheon-text)]">
              {peer.deviceName}
            </h4>
            {peer.user?.role === 'admin' && (
              <span className="rounded border border-[var(--fintheon-accent)]/35 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--fintheon-accent)]">
                admin
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
            <Apple className="h-3.5 w-3.5" />
            <span>{platformLabel(peer.platform)}</span>
          </div>
        </div>
        {peer.hermesAvailable && (
          <PlugZap className="h-4 w-4 text-[var(--fintheon-accent)]" aria-label="Hermes available" />
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {(peer.assignedAgents.length > 0 ? peer.assignedAgents : ['unassigned']).slice(0, 4).map((agent) => (
          <span
            key={`${peer.id}-${agent}`}
            className="rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] px-1.5 py-0.5 text-[10px] text-zinc-300"
          >
            {agent}
          </span>
        ))}
      </div>

      <div className="space-y-1 text-[11px] text-zinc-400">
        <div className="flex items-center justify-between">
          <span>Desk</span>
          <span className="text-zinc-300">{peer.deskName || 'Unassigned'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Heartbeat</span>
          <span className="text-zinc-300">{formatRelativeTime(peer.heartbeatAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Capabilities</span>
          <span className="inline-flex items-center gap-1 text-zinc-300">
            <Cpu className="h-3 w-3" />
            {peer.capabilities.length}
          </span>
        </div>
      </div>
    </article>
  );
}

