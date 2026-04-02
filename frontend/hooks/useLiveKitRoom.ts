// S13-T3: LiveKit room hook for group voice calls
import { useState, useRef, useCallback, useEffect } from 'react';
import { Room, RoomEvent, createLocalAudioTrack, type RemoteParticipant, type LocalAudioTrack } from 'livekit-client';
import type { CallState, CallParticipant } from '../types/livekit';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

async function fetchToken(roomName: string, displayName: string, userId: string) {
  const res = await fetch(`${API_BASE}/api/livekit/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomName, participantName: displayName, participantIdentity: userId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Token request failed' }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ token: string; url: string }>;
}

function mapParticipants(room: Room): CallParticipant[] {
  const activeSpeakers = new Set(room.activeSpeakers.map((p) => p.identity));
  const result: CallParticipant[] = [];

  // Local participant
  const local = room.localParticipant;
  if (local.identity) {
    result.push({
      identity: local.identity,
      displayName: local.name || local.identity,
      isMuted: !local.isMicrophoneEnabled,
      isSpeaking: activeSpeakers.has(local.identity),
    });
  }

  // Remote participants
  room.remoteParticipants.forEach((p: RemoteParticipant) => {
    result.push({
      identity: p.identity,
      displayName: p.name || p.identity,
      isMuted: !p.isMicrophoneEnabled,
      isSpeaking: activeSpeakers.has(p.identity),
    });
  });

  return result;
}

export function useLiveKitRoom() {
  const { userId } = useAuth();
  const { traderName } = useSettings();
  const roomRef = useRef<Room | null>(null);
  const trackRef = useRef<LocalAudioTrack | null>(null);

  const [callState, setCallState] = useState<CallState>('idle');
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshParticipants = useCallback(() => {
    if (roomRef.current) setParticipants(mapParticipants(roomRef.current));
  }, []);

  const connect = useCallback(async (roomName = 'trading-floor') => {
    if (roomRef.current?.state === 'connected') return;
    setCallState('connecting');
    setError(null);

    try {
      const { token, url } = await fetchToken(roomName, traderName || 'Anonymous', userId);

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, refreshParticipants);
      room.on(RoomEvent.ParticipantDisconnected, refreshParticipants);
      room.on(RoomEvent.TrackMuted, refreshParticipants);
      room.on(RoomEvent.TrackUnmuted, refreshParticipants);
      room.on(RoomEvent.ActiveSpeakersChanged, refreshParticipants);
      room.on(RoomEvent.Disconnected, () => {
        setCallState('idle');
        setParticipants([]);
      });

      await room.connect(url, token);

      const localTrack = await createLocalAudioTrack();
      trackRef.current = localTrack;
      await room.localParticipant.publishTrack(localTrack);

      setCallState('connected');
      setIsMuted(false);
      refreshParticipants();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
      setCallState('error');
      roomRef.current?.disconnect();
      roomRef.current = null;
    }
  }, [userId, traderName, refreshParticipants]);

  const disconnect = useCallback(async () => {
    setCallState('disconnecting');
    trackRef.current?.stop();
    trackRef.current = null;
    roomRef.current?.disconnect();
    roomRef.current = null;
    setCallState('idle');
    setParticipants([]);
    setIsMuted(false);
    setError(null);
  }, []);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const newMuted = !isMuted;
    await room.localParticipant.setMicrophoneEnabled(!newMuted);
    setIsMuted(newMuted);
    refreshParticipants();
  }, [isMuted, refreshParticipants]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      trackRef.current?.stop();
      roomRef.current?.disconnect();
    };
  }, []);

  return { callState, participants, isMuted, error, connect, disconnect, toggleMute };
}
