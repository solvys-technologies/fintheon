import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useBackend } from '../../lib/backend';
import { useAuth } from '../../contexts/AuthContext';
import { DeskPanel } from './DeskPanel';
import { PeerCard } from './PeerCard';
import type { PeerRecord } from './types';

interface PeerCarouselProps {
  collapsed?: boolean;
}

export function PeerCarousel({ collapsed = false }: PeerCarouselProps) {
  const backend = useBackend();
  const { userId } = useAuth();
  const [peers, setPeers] = useState<PeerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeskPanel, setShowDeskPanel] = useState(false);

  const refreshPeers = useCallback(async () => {
    try {
      setError(null);
      const result = await backend.peers.list();
      setPeers(result.peers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load peers');
      setPeers([]);
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    void refreshPeers();
  }, [refreshPeers]);

  useEffect(() => {
    const sb = supabase;
    if (!sb) return;

    const channel = sb
      .channel('claude-peers-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'claude_peers' },
        () => void refreshPeers(),
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [refreshPeers]);

  const isAdmin = useMemo(() => {
    const me = peers.find((peer) => peer.userId === userId);
    return me?.user?.role === 'admin';
  }, [peers, userId]);

  if (collapsed) {
    return null;
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--fintheon-text)]">Claude Peers</h3>
          <p className="text-[11px] text-zinc-400">
            {loading ? 'Syncing peers…' : `${peers.length} connected`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => void refreshPeers()}
            className="rounded border border-[var(--fintheon-accent)]/30 p-1.5 text-[var(--fintheon-accent)]"
            title="Refresh peers"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowDeskPanel((value) => !value)}
              className="inline-flex items-center gap-1 rounded border border-[var(--fintheon-accent)]/30 px-2 py-1 text-xs text-[var(--fintheon-accent)]"
              title="Toggle desk manager"
            >
              {showDeskPanel ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Desk Admin
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {peers.length === 0 && !loading ? (
        <div className="rounded-lg border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-surface)] px-3 py-2 text-sm text-zinc-400">
          No peers connected.
        </div>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2">
            {peers.map((peer) => (
              <PeerCard
                key={peer.id}
                peer={peer}
                isActive={peer.userId === userId}
              />
            ))}
          </div>
        </div>
      )}

      {showDeskPanel && (
        <DeskPanel peers={peers} isAdmin={Boolean(isAdmin)} onUpdated={refreshPeers} />
      )}
    </section>
  );
}
