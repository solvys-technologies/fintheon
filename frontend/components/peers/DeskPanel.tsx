import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useBackend } from '../../lib/backend';
import type { DeskRecord, PeerRecord } from './types';

interface DeskPanelProps {
  peers: PeerRecord[];
  isAdmin: boolean;
  onUpdated?: () => Promise<void> | void;
}

export function DeskPanel({ peers, isAdmin, onUpdated }: DeskPanelProps) {
  const backend = useBackend();
  const [desks, setDesks] = useState<DeskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sectorFocusInput, setSectorFocusInput] = useState('');
  const [busyPeerId, setBusyPeerId] = useState<string | null>(null);

  const deskOptions = useMemo(
    () => desks.map((desk) => ({ value: desk.id, label: desk.name })),
    [desks],
  );

  useEffect(() => {
    if (!isAdmin) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function refresh() {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await backend.peers.listDesks();
      setDesks(res.desks);
    } catch {
      setDesks([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateDesk() {
    const trimmed = name.trim();
    if (!trimmed) return;

    const sectorFocus = sectorFocusInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    await backend.peers.createDesk({
      name: trimmed,
      description: description.trim() || undefined,
      sectorFocus,
    });

    setName('');
    setDescription('');
    setSectorFocusInput('');
    setShowCreate(false);
    await refresh();
    await onUpdated?.();
  }

  async function handleAssign(peerId: string, deskId: string) {
    if (!deskId) return;
    setBusyPeerId(peerId);
    try {
      await backend.peers.assignDesk(deskId, peerId);
      await onUpdated?.();
      await refresh();
    } finally {
      setBusyPeerId(null);
    }
  }

  if (!isAdmin) return null;

  return (
    <section className="rounded-xl border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)] p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--fintheon-text)]">Desk Admin</h3>
          <p className="text-[11px] text-zinc-400">Create desks and assign team members.</p>
        </div>
        <button
          onClick={() => setShowCreate((value) => !value)}
          className="inline-flex items-center gap-1 rounded border border-[var(--fintheon-accent)]/30 px-2 py-1 text-xs text-[var(--fintheon-accent)]"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Desk
        </button>
      </div>

      {showCreate && (
        <div className="mb-3 grid gap-2 rounded-lg border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)] p-2.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Desk name"
            className="rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)] px-2 py-1.5 text-sm text-[var(--fintheon-text)] outline-none"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)] px-2 py-1.5 text-sm text-[var(--fintheon-text)] outline-none"
          />
          <input
            value={sectorFocusInput}
            onChange={(e) => setSectorFocusInput(e.target.value)}
            placeholder="Sector focus tags (comma-separated)"
            className="rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)] px-2 py-1.5 text-sm text-[var(--fintheon-text)] outline-none"
          />
          <button
            onClick={() => void handleCreateDesk()}
            className="rounded border border-[var(--fintheon-accent)]/30 px-2 py-1.5 text-xs font-medium text-[var(--fintheon-accent)]"
          >
            Save Desk
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-zinc-500">Loading desks…</p>
      ) : (
        <div className="space-y-2">
          {peers.map((peer) => (
            <div
              key={peer.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-bg)] px-2.5 py-2"
            >
              <div>
                <p className="text-sm text-[var(--fintheon-text)]">{peer.deviceName}</p>
                <p className="text-[11px] text-zinc-500">
                  Current desk: {peer.deskName || 'Unassigned'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={peer.deskId ?? ''}
                  onChange={(e) => void handleAssign(peer.id, e.target.value)}
                  disabled={busyPeerId === peer.id}
                  className="rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)] px-2 py-1 text-xs text-[var(--fintheon-text)]"
                >
                  <option value="">Unassigned</option>
                  {deskOptions.map((desk) => (
                    <option key={desk.value} value={desk.value}>
                      {desk.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {peers.length === 0 && (
            <p className="text-xs text-zinc-500">No team members available for assignment yet.</p>
          )}
        </div>
      )}
    </section>
  );
}

