// TODO: remove — replaced by Fluxer embed voice (2026-04-12). Kept until Fluxer is confirmed stable.
// [claude-code 2026-04-01] LiveKit Cloud voice — real WebRTC audio via @livekit/components-react
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  Users,
  GripVertical,
  Phone,
  PictureInPicture2,
  X,
} from "@/components/shared/iso-icons";
import {
  LiveKitRoom,
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
import { useBackend } from "../../lib/backend";
import { useAuth } from "../../contexts/AuthContext";
import { VoiceAudioRenderer } from "./VoiceAudioRenderer";
import type { VoiceParticipantRecord } from "./types";

export type VoiceWidgetDockTarget = "floating" | "header";

type Position = { x: number; y: number };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/* ── Compact header-docked voice button (legacy — kept for minimal header icon) ── */

export function VoiceRoomHeaderButton({
  onClick,
  participantCount,
  joined,
}: {
  onClick: () => void;
  participantCount: number;
  joined: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onClick}
        className={`relative p-1.5 rounded-lg transition-colors ${
          joined
            ? "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]"
            : "text-gray-500 hover:text-gray-300 hover:bg-zinc-800/50"
        }`}
        title={
          joined ? `Voice Room (${participantCount} in call)` : "Voice Room"
        }
      >
        <Phone className="w-3.5 h-3.5" />
      </button>
      {joined && (
        <span
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium tracking-wide"
          style={{
            color: "var(--fintheon-accent)",
            backgroundColor:
              "color-mix(in srgb, var(--fintheon-accent) 12%, transparent)",
          }}
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--fintheon-accent)] animate-pulse" />
          {participantCount}
        </span>
      )}
    </div>
  );
}

/* ── Dockable voice widget (float ↔ header) ────────────────────────── */

interface VoiceWidgetProps {
  target: VoiceWidgetDockTarget;
  onDockToHeader: () => void;
  onUndockToFloating: () => void;
  onClose?: () => void;
  storageKey?: string;
  headerDockZoneId?: string;
}

export function VoiceWidget({
  target,
  onDockToHeader,
  onUndockToFloating,
  onClose,
  storageKey = "fintheon:voice-widget-floating-pos:v1",
  headerDockZoneId = "fintheon-heading-toolbar",
}: VoiceWidgetProps) {
  const backend = useBackend();
  const { userId } = useAuth();
  const [pos, setPos] = useState<Position>({ x: 24, y: 180 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const [muted, setMuted] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<VoiceParticipantRecord[]>(
    [],
  );
  const [configured, setConfigured] = useState(false);
  // LiveKit state
  const [lkToken, setLkToken] = useState<string | null>(null);
  const [lkUrl, setLkUrl] = useState<string | null>(null);

  // Persist floating position
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Position>;
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          setPos({ x: parsed.x, y: parsed.y });
          return;
        }
      }
    } catch {
      /* ignore */
    }
    const x =
      typeof window !== "undefined"
        ? Math.max(24, window.innerWidth - 300)
        : 24;
    setPos({ x, y: 180 });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  }, [pos, storageKey]);

  // Drag logic with drop-zone detection
  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      const nextX = clamp(
        e.clientX - dragOffset.current.x,
        8,
        window.innerWidth - 280,
      );
      const nextY = clamp(
        e.clientY - dragOffset.current.y,
        74,
        window.innerHeight - 220,
      );
      setPos({ x: nextX, y: nextY });
    };

    const onUp = (e: MouseEvent) => {
      setDragging(false);
      const dockZone = document.getElementById(headerDockZoneId);
      if (!dockZone) return;
      const rect = dockZone.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (inside) onDockToHeader();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, headerDockZoneId, onDockToHeader]);

  // Poll participants when joined (fallback for stub mode, and keep backend in sync)
  useEffect(() => {
    if (!joined || !roomId) return;
    const poll = async () => {
      const res = await backend.peers.listVoiceParticipants(roomId);
      if (!configured) setParticipants(res.participants);
      setConfigured(res.configured);
    };
    void poll();
    const interval = setInterval(() => void poll(), 5000);
    return () => clearInterval(interval);
  }, [backend, joined, roomId, configured]);

  async function handleJoin() {
    setJoining(true);
    try {
      const res = await backend.peers.joinVoice({
        roomName: "Claude Peers Group Call",
      });
      setRoomId(res.room.id);
      setConfigured(res.configured);
      setJoined(true);

      if (res.configured && res.url) {
        setLkToken(res.token);
        setLkUrl(res.url);
      } else {
        const participantsRes = await backend.peers.listVoiceParticipants(
          res.room.id,
        );
        setParticipants(participantsRes.participants);
      }
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
    setLkToken(null);
    setLkUrl(null);
  }

  const handleMuteToggle = useCallback(() => {
    setMuted((v) => !v);
  }, []);

  const callControls = (
    <div className="flex items-center gap-2">
      {!joined ? (
        <button
          onClick={() => void handleJoin()}
          disabled={joining}
          className="flex-1 rounded border border-[var(--fintheon-accent)]/30 px-2 py-1.5 text-xs font-medium text-[var(--fintheon-accent)] disabled:opacity-50"
        >
          {joining ? "Joining..." : "Join Call"}
        </button>
      ) : (
        <>
          <button
            onClick={handleMuteToggle}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-[var(--fintheon-accent)]/25 px-2 py-1.5 text-xs text-[var(--fintheon-text)]"
          >
            {muted ? (
              <MicOff className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
            {muted ? "Unmute" : "Mute"}
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
  );

  const floating = target === "floating";

  /* ── Header-docked mode (static toolbar) ── */
  const headerContent = !floating ? (
    <div className="flex items-center gap-2 bg-[var(--fintheon-bg)] rounded-lg px-3.5 h-8 min-w-[240px]">
      <button
        onClick={onUndockToFloating}
        className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
        title="Detach to floating"
      >
        <PictureInPicture2 className="w-3.5 h-3.5" />
      </button>
      <Phone className="w-3 h-3 text-[var(--fintheon-accent)]" />
      <span className="text-[10px] text-[var(--fintheon-accent)] font-semibold tracking-[0.14em] uppercase">
        Voice
      </span>
      <span className="text-[10px] text-zinc-500 flex items-center gap-1">
        <Users className="w-3 h-3" />
        {participants.length}
      </span>
      {joined && (
        <>
          <button
            onClick={handleMuteToggle}
            className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-400 hover:text-[var(--fintheon-accent)] transition-colors"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <MicOff className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => void handleLeave()}
            className="p-1 rounded hover:bg-red-500/10 text-red-400 transition-colors"
            title="Leave call"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      {!joined && (
        <button
          onClick={() => void handleJoin()}
          disabled={joining}
          className="text-[10px] text-[var(--fintheon-accent)]/70 hover:text-[var(--fintheon-accent)] transition-colors disabled:opacity-50"
        >
          {joining ? "Joining..." : "Join"}
        </button>
      )}
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
          title="Hide"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  ) : null;

  if (!floating) {
    const content = headerContent!;
    if (lkToken && lkUrl) {
      return (
        <LiveKitRoom
          serverUrl={lkUrl}
          token={lkToken}
          audio
          video={false}
          connect
        >
          <LiveKitVoiceSync
            muted={muted}
            onParticipantsChange={setParticipants}
          />
          <VoiceAudioRenderer />
          {content}
        </LiveKitRoom>
      );
    }
    return content;
  }

  /* ── Floating mode ── */
  const floatingContent = (
    <aside
      className="fixed z-50 w-[260px] rounded-2xl border border-[var(--fintheon-accent)]/30 bg-[var(--fintheon-surface)] p-2.5 shadow-2xl"
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
    >
      <header className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onMouseDown={(e) => {
              setDragging(true);
              dragOffset.current = { x: 14, y: 14 };
              e.preventDefault();
              e.stopPropagation();
            }}
            className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors cursor-grab active:cursor-grabbing"
            title="Drag"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <button
            onClick={onDockToHeader}
            className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
            title="Dock to header"
          >
            <PictureInPicture2 className="w-4 h-4" />
          </button>
          <span className="text-[10px] text-[var(--fintheon-accent)]/70 tracking-[0.18em] uppercase">
            Voice Room
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
            <Users className="h-3.5 w-3.5" />
            {participants.length}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
              title="Hide"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
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
          <span className="text-[11px] text-zinc-500">
            No participants yet.
          </span>
        )}
      </div>

      {callControls}

      <div className="mt-2 text-[10px] text-zinc-600">
        Drag into the header to fuse, or click the PiP icon.
      </div>
    </aside>
  );

  if (lkToken && lkUrl) {
    return (
      <LiveKitRoom
        serverUrl={lkUrl}
        token={lkToken}
        audio
        video={false}
        connect
      >
        <LiveKitVoiceSync
          muted={muted}
          onParticipantsChange={setParticipants}
        />
        <VoiceAudioRenderer />
        {floatingContent}
      </LiveKitRoom>
    );
  }

  return floatingContent;
}

/* ── LiveKit sync: mute state + participant list ── */

function LiveKitVoiceSync({
  muted,
  onParticipantsChange,
}: {
  muted: boolean;
  onParticipantsChange: (p: VoiceParticipantRecord[]) => void;
}) {
  const { localParticipant } = useLocalParticipant();
  const lkParticipants = useParticipants();

  // Sync mute state to local microphone track
  useEffect(() => {
    if (localParticipant) {
      void localParticipant.setMicrophoneEnabled(!muted);
    }
  }, [muted, localParticipant]);

  // Map LiveKit participants to VoiceParticipantRecord for UI
  useEffect(() => {
    const mapped: VoiceParticipantRecord[] = lkParticipants.map((p) => ({
      peerId: p.identity,
      joinedAt: new Date(Number(p.joinedAt) * 1000 || Date.now()).toISOString(),
    }));
    onParticipantsChange(mapped);
  }, [lkParticipants, onParticipantsChange]);

  return null;
}
