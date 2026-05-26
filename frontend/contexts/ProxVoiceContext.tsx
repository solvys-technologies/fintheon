import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  type LocalAudioTrack,
  type Participant,
  type RemoteTrack,
} from "livekit-client";
import { useBackend } from "../lib/backend";
import { useSettings } from "./SettingsContext";
import type { ProxVoicePresence, ProxVoiceProfile } from "../lib/services";

type ProxVoiceState = "idle" | "connecting" | "connected" | "error";

interface ProxVoiceParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  isSpeaking: boolean;
  audioLevel?: number;
  cadence?: number;
  isMuted: boolean;
  outputMuted: boolean;
  leaving?: boolean;
  profile: ProxVoiceProfile | null;
}

interface ProxVoiceContextValue {
  state: ProxVoiceState;
  error: string | null;
  muted: boolean;
  deafened: boolean;
  participants: ProxVoiceParticipant[];
  presence: ProxVoicePresence[];
  connect: () => Promise<void>;
  disconnect: () => void;
  toggleMute: () => Promise<void>;
  toggleDeafen: () => void;
  toggleParticipantOutput: (identity: string) => void;
  refreshPresence: () => Promise<void>;
}

const ProxVoiceContext = createContext<ProxVoiceContextValue | null>(null);

function parseProfile(participant: Participant): ProxVoiceProfile | null {
  try {
    const parsed = JSON.parse(participant.metadata || "{}") as {
      profile?: ProxVoiceProfile;
    };
    return parsed.profile ?? null;
  } catch {
    return null;
  }
}

function readAudioLevel(participant: Participant, active: boolean) {
  const level = (participant as Participant & { audioLevel?: number })
    .audioLevel;
  if (typeof level === "number" && Number.isFinite(level)) {
    return Math.max(0, Math.min(1, level));
  }
  return active ? 0.45 : 0;
}

export function ProxVoiceProvider({ children }: { children: React.ReactNode }) {
  const backend = useBackend();
  const { selectedSymbol } = useSettings();
  const roomRef = useRef<Room | null>(null);
  const trackRef = useRef<LocalAudioTrack | null>(null);
  const audioEls = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioIdentity = useRef<Map<string, string>>(new Map());
  const disconnectRef = useRef<() => void>(() => {});
  const [state, setState] = useState<ProxVoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [outputMuted, setOutputMuted] = useState<Set<string>>(new Set());
  const [participants, setParticipants] = useState<ProxVoiceParticipant[]>([]);
  const [presence, setPresence] = useState<ProxVoicePresence[]>([]);
  const previousParticipants = useRef<Map<string, ProxVoiceParticipant>>(
    new Map(),
  );

  const refreshParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      const leaving = Array.from(previousParticipants.current.values()).map(
        (participant) => ({
          ...participant,
          leaving: true,
        }),
      );
      setParticipants(leaving);
      window.setTimeout(() => setParticipants([]), 260);
      return;
    }
    const active = new Set(room.activeSpeakers.map((p) => p.identity));
    const allParticipants: Participant[] = [
      room.localParticipant,
      ...Array.from(room.remoteParticipants.values()),
    ];
    const mapped: ProxVoiceParticipant[] = allParticipants.map(
      (participant) => {
        const isSpeaking = active.has(participant.identity);
        const audioLevel = readAudioLevel(participant, isSpeaking);
        return {
          identity: participant.identity,
          name: participant.name || participant.identity,
          isLocal: participant.identity === room.localParticipant.identity,
          isSpeaking,
          audioLevel,
          cadence: audioLevel,
          isMuted: !participant.isMicrophoneEnabled,
          outputMuted: outputMuted.has(participant.identity),
          leaving: false,
          profile: parseProfile(participant),
        };
      },
    );
    const nextIds = new Set(mapped.map((participant) => participant.identity));
    const leaving = Array.from(previousParticipants.current.values())
      .filter((participant) => !nextIds.has(participant.identity))
      .map((participant) => ({ ...participant, leaving: true }));
    const merged = [...mapped, ...leaving];
    previousParticipants.current = new Map(
      mapped.map((participant) => [participant.identity, participant]),
    );
    setParticipants(merged);
    if (leaving.length > 0) {
      window.setTimeout(() => {
        setParticipants((current) =>
          current.filter((participant) => !participant.leaving),
        );
      }, 260);
    }
  }, [outputMuted]);

  const refreshPresence = useCallback(async () => {
    const res = await backend.proxVoice.participants();
    setPresence(res.participants);
  }, [backend.proxVoice]);

  const syncPresence = useCallback(
    async (patch?: { muted?: boolean; deafened?: boolean }) => {
      await backend.proxVoice.presence({
        surface: "fintheon",
        ticker: selectedSymbol.symbol || null,
        muted: patch?.muted ?? muted,
        deafened: patch?.deafened ?? deafened,
      });
      await refreshPresence();
    },
    [
      backend.proxVoice,
      deafened,
      muted,
      refreshPresence,
      selectedSymbol.symbol,
    ],
  );

  const disconnect = useCallback(() => {
    trackRef.current?.stop();
    trackRef.current = null;
    roomRef.current?.disconnect();
    roomRef.current = null;
    for (const el of audioEls.current.values()) el.remove();
    audioEls.current.clear();
    audioIdentity.current.clear();
    setState("idle");
    refreshParticipants();
  }, [refreshParticipants]);

  const connect = useCallback(async () => {
    if (roomRef.current?.state === "connected") return;
    setState("connecting");
    setError(null);
    try {
      const credentials = await backend.proxVoice.token();
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      room.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, _pub, participant) => {
          if (track.source !== Track.Source.Microphone) return;
          const el = track.attach() as HTMLAudioElement;
          el.autoplay = true;
          el.muted = deafened || outputMuted.has(participant.identity);
          const trackId = track.sid ?? `${Date.now()}-${audioEls.current.size}`;
          audioEls.current.set(trackId, el);
          audioIdentity.current.set(trackId, participant.identity);
          document.body.appendChild(el);
        },
      );
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => el.remove());
        if (track.sid) {
          audioEls.current.delete(track.sid);
          audioIdentity.current.delete(track.sid);
        }
      });
      room.on(RoomEvent.ParticipantConnected, refreshParticipants);
      room.on(RoomEvent.ParticipantDisconnected, refreshParticipants);
      room.on(RoomEvent.ActiveSpeakersChanged, refreshParticipants);
      room.on(RoomEvent.TrackMuted, refreshParticipants);
      room.on(RoomEvent.TrackUnmuted, refreshParticipants);
      room.on(RoomEvent.Disconnected, disconnect);
      await room.connect(credentials.url, credentials.token);
      let localTrack: LocalAudioTrack | null = null;
      try {
        localTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
        trackRef.current = localTrack;
        await room.localParticipant.publishTrack(localTrack);
      } catch {
        setError("Mic unavailable. Connected listen-only.");
      }
      setState("connected");
      setMuted(!localTrack);
      refreshParticipants();
      await syncPresence({ muted: !localTrack });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Voice failed";
      setError(message);
      setState("error");
      disconnect();
    }
  }, [
    backend.proxVoice,
    deafened,
    disconnect,
    refreshParticipants,
    syncPresence,
  ]);

  const toggleMute = useCallback(async () => {
    const next = !muted;
    await roomRef.current?.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
    refreshParticipants();
    await syncPresence({ muted: next });
  }, [muted, refreshParticipants, syncPresence]);

  const toggleDeafen = useCallback(() => {
    const next = !deafened;
    for (const el of audioEls.current.values()) el.muted = next;
    setDeafened(next);
    void syncPresence({ deafened: next });
  }, [deafened, syncPresence]);

  const toggleParticipantOutput = useCallback((identity: string) => {
    setOutputMuted((current) => {
      const next = new Set(current);
      if (next.has(identity)) next.delete(identity);
      else next.add(identity);
      for (const [trackId, el] of audioEls.current.entries()) {
        if (audioIdentity.current.get(trackId) === identity)
          el.muted = next.has(identity);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    disconnectRef.current = disconnect;
  }, [disconnect]);

  useEffect(() => () => disconnectRef.current(), []);

  useEffect(() => {
    if (state !== "connected") return;
    const timer = setInterval(() => void syncPresence(), 15_000);
    return () => clearInterval(timer);
  }, [state, syncPresence]);

  const value = useMemo<ProxVoiceContextValue>(
    () => ({
      state,
      error,
      muted,
      deafened,
      participants,
      presence,
      connect,
      disconnect,
      toggleMute,
      toggleDeafen,
      toggleParticipantOutput,
      refreshPresence,
    }),
    [
      connect,
      deafened,
      disconnect,
      error,
      muted,
      participants,
      presence,
      refreshPresence,
      state,
      toggleDeafen,
      toggleParticipantOutput,
      toggleMute,
    ],
  );

  return (
    <ProxVoiceContext.Provider value={value}>
      {children}
    </ProxVoiceContext.Provider>
  );
}

export function useProxVoice() {
  const ctx = useContext(ProxVoiceContext);
  if (!ctx)
    throw new Error("useProxVoice must be used within ProxVoiceProvider");
  return ctx;
}
