import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Users, GripVertical, Phone } from 'lucide-react';
import { useBackend } from '../../lib/backend';
import { useAuth } from '../../contexts/AuthContext';
import type { VoiceParticipantRecord } from './types';

type Position = { x: number; y: number };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/* ── Compact header-docked voice button ────────────────────────────── */

export function VoiceRoomHeaderButton({ onClick, participantCount, joined }: { onClick: () => void; participantCount: number; joined: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`relative p-1.5 rounded-lg transition-colors ${
        joined
          ? 'bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]'
          : 'text-gray-500 hover:text-gray-300 hover:bg-zinc-800/50'
      }`}
      title={joined ? `Voice Room (${participantCount} in call)` : 'Voice Room'}
    >
      <Phone className="w-3.5 h-3.5" />
      {participantCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-[var(--fintheon-accent)] text-[var(--fintheon-bg)] text-[8px] font-bold leading-none">
          {participantCount}
        </span>
      )}
    </button>
  );
}

/* ── Full floating voice widget ────────────────────────────────────── */

export function VoiceWidget() {
  const backend = useBackend();
  const { userId } = useAuth();
  const [position, setPosition] = useState<Position>({ x: 24, y: 180 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const [muted, setMuted] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<VoiceParticipantRecord[]>([]);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: MouseEvent) => {
      const nextX = clamp(event.clientX - dragOffset.current.x, 8, window.innerWidth - 280);
      const nextY = clamp(event.clientY - dragOffset.current.y, 74, window.innerHeight - 220);
      setPosition({ x: nextX, y: nextY });
    };

    const onUp = () => setDragging(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  useEffect(() => {
    if (!joined || !roomId) return;

    const poll = async () => {
      const res = await backend.peers.listVoiceParticipants(roomId);
      setParticipants(res.participants);
      setConfigured(res.configured);
    };

    void poll();
    const interval = setInterval(() => void poll(), 5000);
    return () => clearInterval(interval);
  }, [backend, joined, roomId]);

  async function handleJoin() {
    setJoining(true);
    try {
      const res = await backend.peers.joinVoice({ roomName: 'Claude Peers Group Call' });
      setRoomId(res.room.id);
      setConfigured(res.configured);
      setJoined(true);
      const participantsRes = await backend.peers.listVoiceParticipants(res.room.id);
      setParticipants(participantsRes.participants);
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    if (!roomId) return;
    await backend.peers.leaveVoice({ roomId });
    setJoined(false);
    setParticipants([]);
    setRoomId(null);
    setMuted(false);
  }

  return (
    <aside
      className="fixed z-50 w-[260px] rounded-xl border border-[var(--fintheon-accent)]/30 bg-[var(--fintheon-surface)] p-2.5 shadow-2xl"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      <header className="mb-2 flex items-center justify-between">
        <button
          onMouseDown={(event) => {
            setDragging(true);
            dragOffset.current = { x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY };
          }}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-zinc-400 hover:bg-[var(--fintheon-accent)]/10"
          title="Drag voice widget"
        >
          <GripVertical className="h-3.5 w-3.5" />
          Voice Room
        </button>
        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
          <Users className="h-3.5 w-3.5" />
          {participants.length}
        </span>
      </header>

      {!configured && (
        <p className="mb-2 rounded border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)] px-2 py-1 text-[11px] text-zinc-400">
          Voice not configured. Running in mock mode.
        </p>
      )}

      <div className="mb-2 flex flex-wrap gap-1">
        {participants.slice(0, 8).map((participant) => (
          <div
            key={`${participant.peerId}-${participant.joinedAt}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--fintheon-accent)]/25 bg-[var(--fintheon-bg)] text-[10px] text-[var(--fintheon-text)]"
            title={participant.peerId}
          >
            {participant.peerId.slice(0, 2).toUpperCase()}
          </div>
        ))}
        {participants.length === 0 && (
          <span className="text-[11px] text-zinc-500">No participants yet.</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!joined ? (
          <button
            onClick={() => void handleJoin()}
            disabled={joining}
            className="flex-1 rounded border border-[var(--fintheon-accent)]/30 px-2 py-1.5 text-xs font-medium text-[var(--fintheon-accent)] disabled:opacity-50"
          >
            {joining ? 'Joining…' : 'Join Call'}
          </button>
        ) : (
          <>
            <button
              onClick={() => setMuted((value) => !value)}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-[var(--fintheon-accent)]/25 px-2 py-1.5 text-xs text-[var(--fintheon-text)]"
            >
              {muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {muted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={() => void handleLeave()}
              className="inline-flex items-center justify-center rounded border border-red-400/30 px-2 py-1.5 text-xs text-red-300"
              title={`Leave room as ${userId}`}
            >
              <PhoneOff className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

